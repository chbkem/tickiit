const { normalize, NormalizeError } = require("./normalize");
const { createModel } = require("../model");
const { resolveRequester } = require("../identity");
const { classifyTriage } = require("../agents/classify");
const { prioritizeTriage } = require("../agents/prioritize");
const { createTicketAgent } = require("../agents/create");
const { draftReplyAgent } = require("../agents/reply");
const ticketService = require("../../services/ticketService");
const prisma = require("../../lib/prisma");
const clerkClient = require("../../lib/clerk");
const logger = require("../../lib/logger");
const ApiError = require("../../utils/ApiError");
const { PRIORITIES, TICKET_TYPES } = require("../../constants/ticket");

const MAX_SUBJECT_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 8000;

const ZERO_USAGE = Object.freeze({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });

const addUsage = (total = ZERO_USAGE, part = ZERO_USAGE) => ({
  inputTokens: (total.inputTokens ?? 0) + (part.inputTokens ?? 0),
  outputTokens: (total.outputTokens ?? 0) + (part.outputTokens ?? 0),
  totalTokens: (total.totalTokens ?? 0) + (part.totalTokens ?? 0),
});

/**
 * shouldAutoReply — autoReply is explicit-request gated; when the field is
 * absent the AI_AUTO_REPLY env var decides (default false).
 */
const shouldAutoReply = (autoReply, env = process.env) => {
  if (autoReply === true) return true;
  if (autoReply === false) return false;
  return String(env.AI_AUTO_REPLY ?? "").toLowerCase() === "true";
};

const enforceCleanDraft = (draft) => {
  const cleanRequired = (value, max, message) => {
    if (typeof value !== "string" || value.trim() === "") throw new Error(message);
    return value.slice(0, max);
  };
  const subject = cleanRequired(draft.subject, MAX_SUBJECT_LENGTH, "draft.subject is required");
  const type = TICKET_TYPES.includes(draft.type) ? draft.type : "TASK";
  const priority = PRIORITIES.includes(draft.priority) ? draft.priority : "MEDIUM";
  const description =
    typeof draft.description === "string" && draft.description.trim() !== ""
      ? draft.description.slice(0, MAX_DESCRIPTION_LENGTH)
      : null;
  return { subject, description, type, priority };
};

const persistTicket = async ({ draft, ctx }) =>
  ctx.ticketService.createTicket({
    data: {
      ...enforceCleanDraft(draft),
      source: ctx.channel,
      orgId: ctx.orgId,
      requesterId: ctx.identity.requesterId,
      requesterName: ctx.identity.requesterName,
      requesterEmail: ctx.identity.requesterEmail,
      requesterKey: ctx.identity.requesterKey,
      assigneeId: null,
    },
  });

const serializeTicket = (ticket) => ({
  id: ticket.id,
  ticketNumber: ticket.ticketNumber,
  subject: ticket.subject,
  description: ticket.description,
  status: ticket.status,
  priority: ticket.priority,
  type: ticket.type,
  requesterId: ticket.requesterId,
  requesterName: ticket.requesterName,
  requesterEmail: ticket.requesterEmail,
  assigneeId: ticket.assigneeId,
  orgId: ticket.orgId,
  createdAt: ticket.createdAt,
});

const serializeRequester = (identity) => ({
  kind: identity.requesterKind,
  key: identity.requesterKey,
  name: identity.requesterName,
  email: identity.requesterEmail,
});

/**
 * runTriage — the whole pipeline for POST /api/ai/triage.
 *
 * normalize -> requester identity -> classify -> prioritize -> create (agent
 * with read+create tools) -> optional draft reply.
 *
 * Degradation contract: a ticket is ALWAYS created. Each model step catches
 * its own failures and falls back (type TASK, priority MEDIUM); if the create
 * agent is unavailable it is skipped and the deterministic draft is persisted
 * directly. autoReply only runs when requested (and the model is available);
 * the reply is returned as a draft and never persisted.
 *
 * Throws ApiError(400) for malformed input (delegated from NormalizeError),
 * otherwise resolves to the pipeline result.
 */
const runTriage = async ({ input, deps = {} }) => {
  const env = deps.env ?? process.env;
  const log = deps.logger ?? logger;
  const modelDeps = deps.modelFactory ?? createModel;

  let normalized;
  try {
    normalized = normalize(input.raw, {
      channel: input.channel,
      requesterRef: input.requesterRef,
      orgId: input.orgId,
    });
  } catch (error) {
    if (error instanceof NormalizeError) {
      throw new ApiError(400, error.message);
    }
    throw error;
  }

  const identity = await resolveRequester({
    clerkClient: deps.clerkClient ?? clerkClient,
    requesterRef: normalized.requesterRef,
    name: input.name,
    email: input.email,
  });

  const state = {};
  const ctx = {
    env,
    identity,
    orgId: normalized.orgId,
    channel: normalized.channel,
    prisma: deps.prisma ?? prisma,
    clerkClient: deps.clerkClient ?? clerkClient,
    ticketService: deps.ticketService ?? ticketService,
    createTicket: async (draft) => {
      const ticket = await persistTicket({ draft, ctx });
      state.ticket = ticket;
      return ticket;
    },
  };

  let model = null;
  let modelError = null;
  try {
    model = deps.model ?? modelDeps({ env });
  } catch (error) {
    modelError = error?.message ?? String(error);
    log.warn("AI provider unavailable; triage will run deterministic", { errorMessage: modelError });
  }

  const stages = [];
  let usage = { ...ZERO_USAGE };

  const classified = model
    ? await classifyTriage({ model, normalized, options: deps.stageOptions?.classify })
    : {
        kind: "fallback",
        subject: normalized.subject.slice(0, MAX_SUBJECT_LENGTH),
        description: normalized.body ?? null,
        type: "TASK",
        rationale: null,
        usage: { ...ZERO_USAGE },
        stepCount: 0,
      };
  usage = addUsage(usage, classified.usage);
  stages.push({ stage: "classify", kind: classified.kind, usage: classified.usage, stepCount: classified.stepCount, error: classified.error });

  const prioritized = model
    ? await prioritizeTriage({ model, classified, options: deps.stageOptions?.prioritize })
    : {
        kind: "fallback",
        priority: "MEDIUM",
        rationale: null,
        usage: { ...ZERO_USAGE },
        stepCount: 0,
      };
  usage = addUsage(usage, prioritized.usage);
  stages.push({ stage: "prioritize", kind: prioritized.kind, usage: prioritized.usage, stepCount: prioritized.stepCount, error: prioritized.error });

  const draft = {
    subject: classified.subject,
    description: classified.description,
    type: classified.type,
    priority: prioritized.priority,
  };

  let createStage = null;
  let ticket = null;
  if (model) {
    createStage = await createTicketAgent({
      model,
      ctx,
      state,
      classified,
      prioritized,
      options: deps.stageOptions?.create,
    });
    ticket = createStage.ticket ?? null;
  }
  if (!ticket) {
    const fallbackStage = {
      stage: "create",
      kind: "fallback",
      usage: { ...ZERO_USAGE },
      stepCount: 0,
      toolCalls: [],
      error: createStage?.error ?? (model ? null : "AI provider unavailable; created deterministically"),
    };
    stages.push(fallbackStage);
    ticket = await persistTicket({ draft, ctx });
  } else {
    stages.push({
      stage: "create",
      kind: createStage.kind,
      usage: createStage.usage,
      stepCount: createStage.stepCount,
      toolCalls: createStage.toolCalls,
      error: createStage.error,
    });
    usage = addUsage(usage, createStage.usage);
  }

  const persistLog = {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    orgId: normalized.orgId,
    requesterKind: identity.requesterKind,
    channel: normalized.channel,
    via: "triage",
  };
  log.info("Ticket created via triage", persistLog);

  let replyStage = null;
  const replyEnabledFor = shouldAutoReply(input.autoReply, env);
  if (replyEnabledFor && model) {
    replyStage = await draftReplyAgent({ model, ctx, ticket, options: deps.stageOptions?.reply });
    const replyLog = {
      ticketId: ticket.id,
      stageKind: replyStage.kind,
      draftPersisted: false,
    };
    if (replyStage.reply) {
      usage = addUsage(usage, replyStage.usage);
      log.info("Triage draft reply generated", replyLog);
    } else {
      log.warn("Triage draft reply failed; returning none", { ...replyLog, error: replyStage.error });
    }
    stages.push({ stage: "reply", kind: replyStage.kind, usage: replyStage.usage, stepCount: replyStage.stepCount, error: replyStage.error });
  } else if (replyEnabledFor && !model) {
    stages.push({ stage: "reply", kind: "fallback", usage: { ...ZERO_USAGE }, stepCount: 0, error: "AI provider unavailable; no draft reply" });
  }

  return {
    ticket: serializeTicket(ticket),
    requester: serializeRequester(identity),
    draftReply: replyStage?.reply ?? null,
    stages,
    usage,
    modelError,
  };
};

module.exports = { runTriage, shouldAutoReply };