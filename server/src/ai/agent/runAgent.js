const { generateText, Output } = require("ai");

/**
 * createAbortTimeout — bounds a single provider call. Returns an
 * AbortController signal plus a clear() that must be run in a finally block.
 * A caller-supplied timeoutMs wins; otherwise AI_TIMEOUT_MS is honored;
 * no/bad values mean no timeout (caller opted out). The timer is unref'd so
 * it never keeps the process alive.
 */
const createAbortTimeout = (timeoutMs, env = process.env) => {
  const ms = timeoutMs !== undefined && timeoutMs !== null ? Number(timeoutMs) : Number(env.AI_TIMEOUT_MS);
  if (!Number.isFinite(ms) || ms <= 0) {
    return { signal: undefined, clear: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("AI request timed out")), ms);
  if (timer.unref) timer.unref();
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
};

/**
 * mapUsage — normalize a LanguageModelUsage into a plain totals object with
 * safe defaults.
 */
const mapUsage = (usage = {}) => ({
  inputTokens: usage.inputTokens ?? 0,
  outputTokens: usage.outputTokens ?? 0,
  totalTokens: usage.totalTokens ?? 0,
});

/**
 * summarizeToolCalls — flatten the step result tool calls for logging/audit.
 */
const summarizeToolCalls = (steps = []) =>
  (Array.isArray(steps) ? steps : []).flatMap((step) =>
    (Array.isArray(step?.toolCalls) ? step.toolCalls : []).map((call) => ({
      name: call?.toolName ?? call?.name ?? "unknown",
      args: call?.args ?? null,
    })),
  );

const withDefined = (obj) => {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
};

/**
 * normalizeGenerateResult — pure mapping of a generateText step result into
 * the shape the structured agents consume (kept pure so it is unit-testable
 * without the AI SDK).
 */
const normalizeGenerateResult = (result = {}) => ({
  output: result.output,
  rawText: typeof result.text === "string" ? result.text : "",
  usage: mapUsage(result.usage),
  stepCount: result.steps?.length ?? 0,
});

const normalizeToolLoopResult = (result = {}) => ({
  text: typeof result.text === "string" ? result.text : "",
  usage: mapUsage(result.usage),
  toolCalls: summarizeToolCalls(result.steps),
  stepCount: result.steps?.length ?? 0,
});

/**
 * runStructured — one-shot schema-validated generation (classifier,
 * prioritizer, reply). Uses Output.object so the SDK validates the model
 * output against the zod schema and throws when it does not conform; callers
 * catch and fall back to deterministic defaults.
 */
const runStructured = async ({ model, instructions, prompt, schema, temperature, maxOutputTokens, timeoutMs }) => {
  const { signal, clear } = createAbortTimeout(timeoutMs);
  try {
    const result = await generateText(
      withDefined({
        model,
        instructions,
        prompt,
        output: Output.object({ schema }),
        temperature,
        maxOutputTokens,
        abortSignal: signal,
      }),
    );
    return normalizeGenerateResult(result);
  } finally {
    clear();
  }
};

/**
 * runToolLoop — generation with tools for the create agent. The caller
 * supplies stopWhen conditions (hasToolCall/create_ticket, isStepCount).
 */
const runToolLoop = async ({ model, instructions, prompt, tools, stopWhen, temperature, maxOutputTokens, timeoutMs }) => {
  const { signal, clear } = createAbortTimeout(timeoutMs);
  try {
    const result = await generateText(
      withDefined({
        model,
        instructions,
        prompt,
        tools,
        stopWhen,
        temperature,
        maxOutputTokens,
        abortSignal: signal,
      }),
    );
    return normalizeToolLoopResult(result);
  } finally {
    clear();
  }
};

module.exports = {
  mapUsage,
  summarizeToolCalls,
  normalizeGenerateResult,
  normalizeToolLoopResult,
  createAbortTimeout,
  runStructured,
  runToolLoop,
};