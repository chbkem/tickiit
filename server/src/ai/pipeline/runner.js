const { normalize, NormalizeError } = require("./normalize");
const { enrich, createClerkRequesterStore, createClerkAgentPoolService, createOrgPolicyService } = require("./enrich");
const { buildRuntimeContext } = require("./contextAssembly");
const { AgentRuntime } = require("../agent/runtime");
const { Decider } = require("../agent/decider");
const { createContextTools } = require("../agent/tools/index");
const { createTicketTool } = require("../agent/tools/createTicket");
const { finalizeTool } = require("../agent/tools/finalize");
const { OpenAICompatibleProvider } = require("../providers/openaiCompatible");
const { FallbackDeterministicProvider } = require("../providers/fallbackEngine");
const { applyDecision, recordReview, markFailed, ApplyError } = require("./apply");

const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
const DEFAULT_MAX_EVENT_ATTEMPTS = 4;

const noop = () => {};
const child = (parent) =>
  parent && typeof parent.child === "function"
    ? parent.child({})
    : { info: noop, warn: noop, error: noop, debug: noop };

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const isDeterministic = (result) =>
  result?.provider === "fallback-deterministic" || result?.fallback?.used === true;

/**
 * decideDisposition — the core policy decision of the pipeline.
 *
 * Model decisions apply when the breaker is closed and the score meets the
 * configured threshold; everything else (model below threshold, breaker open,
 * or provider fallback) routes to REVIEW — unless the operator has explicitly
 * opted in via AI_FALLBACK_MODE=deterministic and the breaker is still closed.
 * An errored model call has already tripped the breaker via recordFailure() in
 * runPipeline, so `broken` reflects it before the disposition is computed; once
 * the cooldown elapses and the probe succeeds, closed/healthy operation resumes.
 */
const decideDisposition = ({ result, breaker, env = {} }) => {
  const threshold = num(env.AI_CONFIDENCE_THRESHOLD, DEFAULT_CONFIDENCE_THRESHOLD);
  const fallbackMode = String(env.AI_FALLBACK_MODE ?? "review").toLowerCase();
  const broken = Boolean(breaker?.isOpen?.());
  const deterministic = isDeterministic(result);

  if (deterministic) {
    return fallbackMode === "deterministic" && !broken ? "APPLY" : "REVIEW";
  }
  if (broken) return "REVIEW";
  const score = num(result?.confidence?.score, 0);
  return score >= threshold ? "APPLY" : "REVIEW";
};

const resolveProvider = (deps = {}) => {
  const env = deps.env ?? process.env;
  const breaker = deps.breaker;
  const aiEnabled = String(env.AI_ENABLED ?? "false") !== "false";
  const hasModel = Boolean(env.AI_BASE_URL && env.AI_MODEL);
  if (!breaker?.isOpen?.() && aiEnabled && hasModel) {
    return { provider: deps.modelProvider ?? new OpenAICompatibleProvider({ env }), mode: "model" };
  }
  return { provider: deps.fallbackProvider ?? new FallbackDeterministicProvider(), mode: "fallback" };
};

const claimEvent = async ({ prisma, eventId }) => {
  const event = await prisma.ingestionEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status === "PROCESSED" || event.status === "FAILED") return null;
  if (event.status === "PROCESSING") return null;
  const currentAttempts = event.attempts;
  const claimed = await prisma.ingestionEvent.updateMany({
    where: { id: eventId, status: event.status, attempts: currentAttempts },
    data: { status: "PROCESSING", attempts: currentAttempts + 1 },
  });
  return claimed.count === 1 ? { ...event, status: "PROCESSING", attempts: currentAttempts + 1 } : null;
};

const runPipeline = async ({ event, deps }) => {
  const { prisma, clerkClient, ticketService, breaker, knowledgeRetriever, env = process.env, logger } = deps;
  const log = child(logger);
  const maxAttempts = num(env.AI_MAX_EVENT_ATTEMPTS, DEFAULT_MAX_EVENT_ATTEMPTS);

  try {
    const normalized = normalize(event.rawPayload, {
      channel: event.channel,
      requesterRef: event.requesterRef,
      orgId: event.orgId,
    });

    const stores = {
      requesterStore: createClerkRequesterStore({ prisma, clerkClient }),
      agentPoolService: createClerkAgentPoolService({ prisma, clerkClient }),
      orgPolicyService: createOrgPolicyService({ clerkClient }),
    };

    const enriched = await enrich({
      normalized,
      deps: { prisma, clerkClient, knowledgeRetriever },
    });

    const { context, meta: assemblyMeta } = buildRuntimeContext({ enriched });
    const { provider, mode } = resolveProvider({ breaker, env, ...deps });
    const decider = new Decider({ fallbackProvider: deps.fallbackProvider ?? new FallbackDeterministicProvider() });
    const runtime = new AgentRuntime({
      provider,
      tools: [
        ...createContextTools(stores),
        createTicketTool(),
        finalizeTool(),
      ],
      env,
      decider,
    });

    const result = await runtime.run({ context, signal: event._signal });
    const disposition = decideDisposition({ result, breaker, env });

    log.info({
      msg: "pipeline.result",
      provider: result.provider,
      model: result.model,
      mode,
      disposition,
      confidence: result.confidence?.score ?? null,
      deterministic: isDeterministic(result),
      outcome: result.status,
      source: assemblyMeta,
    });

    if (mode === "model" && result.status === "error") {
      breaker?.recordFailure?.();
    }

    const buildSuggestion = (result) => ({
      decision: result.decision,
      confidence: result.confidence ?? result.decision?.confidence ?? null,
      source: result.status ?? null,
      recordedAt: new Date().toISOString(),
    });

    if (disposition === "APPLY") {
      if (!deps.dryRun) {
        await applyDecision({
          event,
          enriched,
          decision: result.decision,
          draft: result.draft ?? null,
          result,
          deps: { prisma, ticketService },
        });
      }
      if (mode === "model") breaker?.recordSuccess?.();
      return { status: "APPLIED", disposition: "APPLY", suggestion: buildSuggestion(result), ticketId: event.ticketId ?? null, result };
    }

    const suggestion = buildSuggestion(result);
    if (!deps.dryRun) {
      await recordReview({ prisma, event, decision: result.decision, result });
    }
    return { status: "REVIEW", disposition: "REVIEW", suggestion, result };
  } catch (error) {
    if (error instanceof NormalizeError) {
      if (!deps.dryRun) await markFailed({ prisma, event, error });
      log.warn({ msg: "pipeline.normalize_failed", error: error.message });
      return { status: "FAILED", disposition: "FAILED", reason: "normalize", error: { message: error.message } };
    }
    if (error instanceof ApplyError) {
      const suggestion = {
        decision: {
          subject: enriched?.subject ?? "Untriaged input",
          type: "REQUEST",
          priority: "MEDIUM",
          assigneeRef: null,
          rationale: error.message,
        },
        confidence: { score: 0 },
        source: "apply-error",
        recordedAt: new Date().toISOString(),
      };
      if (!deps.dryRun) {
        await recordReview({
          prisma,
          event,
          decision: suggestion.decision,
          result: { status: "apply-error", confidence: { score: 0 } },
        });
      }
      log.warn({ msg: "pipeline.apply_failed", error: error.message });
      return { status: "REVIEW", disposition: "REVIEW", reason: "apply", suggestion, error: { message: error.message } };
    }
    throw error;
  }
};

const createWorkerHandler = (deps) => async ([job]) => {
  const { prisma, breaker, logger, env = process.env } = deps;
  const eventId = job?.data?.ingestionEventId;
  if (!eventId) return;
  const claimed = await claimEvent({ prisma, eventId });
  if (!claimed) return;
  const maxAttempts = num(env.AI_MAX_EVENT_ATTEMPTS, DEFAULT_MAX_EVENT_ATTEMPTS);
  if (claimed.attempts > maxAttempts) {
    await markFailed({ prisma, event: claimed, error: new Error("Maximum retry attempts exceeded") });
    return;
  }
  const log = child(logger);
  const pipelineEvent = { ...claimed, _signal: job?.signal };
  try {
    return await runPipeline({ event: pipelineEvent, deps });
  } catch (error) {
    log.error({ msg: "pipeline.unhandled", error: error.message, ingestionEventId: eventId, attempts: claimed.attempts });
    throw error;
  }
};

module.exports = {
  runPipeline,
  claimEvent,
  decideDisposition,
  resolveProvider,
  createWorkerHandler,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_MAX_EVENT_ATTEMPTS,
  isDeterministic,
};