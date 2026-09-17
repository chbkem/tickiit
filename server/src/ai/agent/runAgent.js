const { generateText, Output } = require("ai");

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
const runStructured = async ({ model, instructions, prompt, schema, temperature, maxOutputTokens }) => {
  const result = await generateText(
    withDefined({
      model,
      instructions,
      prompt,
      output: Output.object({ schema }),
      temperature,
      maxOutputTokens,
    }),
  );
  return normalizeGenerateResult(result);
};

/**
 * runToolLoop — generation with tools for the create agent. The caller
 * supplies stopWhen conditions (hasToolCall/create_ticket, isStepCount).
 */
const runToolLoop = async ({ model, instructions, prompt, tools, stopWhen, temperature, maxOutputTokens }) => {
  const result = await generateText(
    withDefined({
      model,
      instructions,
      prompt,
      tools,
      stopWhen,
      temperature,
      maxOutputTokens,
    }),
  );
  return normalizeToolLoopResult(result);
};

module.exports = {
  mapUsage,
  summarizeToolCalls,
  normalizeGenerateResult,
  normalizeToolLoopResult,
  runStructured,
  runToolLoop,
};