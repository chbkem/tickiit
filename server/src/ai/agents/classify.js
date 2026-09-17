const { runStructured } = require("../agent/runAgent");
const { ClassifiedTicket, MAX_SUBJECT_LENGTH } = require("../contracts/triageOutput");

const DEFAULT_TYPE = "TASK";
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

const INSTRUCTIONS =
  "You are the classification agent of a ticketing triage pipeline. Convert the customer's messy inbound message into one clean, concise ticket record.\n" +
  "Rules:\n" +
  "- subject: a short (at most 500 characters) specific summary of the issue.\n" +
  "- description: the full, cleaned explanation; keep the customer's meaning and omit nothing material.\n" +
  "- type: exactly one of TASK|BUG|INCIDENT|REQUEST.\n" +
  "- rationale: one short sentence explaining the chosen type.\n" +
  "Output ONLY the JSON object described by the schema.";

/**
 * classifyTriage — always succeeds. On a model error (or unavoidable config
 * problem) it returns a cleaned fallback: subject from the normalized message,
 * type TASK, kind 'fallback'. A custom runStructured can be injected for tests.
 */
const classifyTriage = async ({ model, normalized, options = {} }) => {
  const run = options.runStructured ?? runStructured;
  const prompt = JSON.stringify({
    channel: normalized.channel,
    subject: normalized.subject ?? null,
    body: normalized.body ?? null,
    requesterRef: normalized.requesterRef ?? null,
    orgId: normalized.orgId ?? null,
  });
  try {
    const result = await run({
      model,
      instructions: INSTRUCTIONS,
      prompt,
      schema: ClassifiedTicket,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    });
    return {
      kind: "model",
      subject: result.output.subject,
      description: result.output.description ?? null,
      type: result.output.type,
      rationale: result.output.rationale ?? null,
      usage: result.usage,
      stepCount: result.stepCount,
    };
  } catch (error) {
    return {
      kind: "fallback",
      subject: normalized.subject.slice(0, MAX_SUBJECT_LENGTH),
      description: normalized.body ?? null,
      type: DEFAULT_TYPE,
      rationale: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      stepCount: 0,
      error: error?.message ?? String(error),
    };
  }
};

module.exports = { classifyTriage, DEFAULT_TYPE, INSTRUCTIONS };