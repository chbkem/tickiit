const { runStructured } = require("../agent/runAgent");
const { PriorityDecision } = require("../contracts/triageOutput");

const DEFAULT_PRIORITY = "MEDIUM";
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_OUTPUT_TOKENS = 2048;

const INSTRUCTIONS =
  "You are the prioritization agent of a ticketing triage pipeline. Given a classified ticket, decide its priority: LOW|MEDIUM|HIGH|URGENT.\n" +
  "Rules:\n" +
  "- URGENT: only for an outage or security breach that blocks work org-wide, or when the customer explicitly states it.\n" +
  "- HIGH: impactful, material single-user or team blockers.\n" +
  "- LOW: cosmetic or no-impact requests.\n" +
  "- Prefer MEDIUM unless there is clear evidence for another level.\n" +
  "- rationale: one short sentence explaining the chosen priority.\n" +
  "Output ONLY the JSON object described by the schema.";

/**
 * prioritizeTriage — always succeeds. On a model error it falls back to
 * MEDIUM (kind 'fallback'). A custom runStructured can be injected for tests.
 */
const prioritizeTriage = async ({ model, classified, options = {} }) => {
  const run = options.runStructured ?? runStructured;
  const prompt = JSON.stringify({
    subject: classified.subject,
    description: classified.description ?? null,
    type: classified.type,
  });
  try {
    const result = await run({
      model,
      instructions: INSTRUCTIONS,
      prompt,
      schema: PriorityDecision,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    });
    return {
      kind: "model",
      priority: result.output.priority,
      rationale: result.output.rationale ?? null,
      usage: result.usage,
      stepCount: result.stepCount,
    };
  } catch (error) {
    return {
      kind: "fallback",
      priority: DEFAULT_PRIORITY,
      rationale: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      stepCount: 0,
      error: error?.message ?? String(error),
    };
  }
};

module.exports = { prioritizeTriage, DEFAULT_PRIORITY, INSTRUCTIONS };