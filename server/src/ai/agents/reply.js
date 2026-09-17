const { runStructured } = require("../agent/runAgent");
const { ReplyDraft } = require("../contracts/triageOutput");

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

const INSTRUCTIONS =
  "You are the support reply agent of a ticketing triage pipeline. Draft a short, friendly, professional reply to the customer confirming their ticket was created.\n" +
  "Rules:\n" +
  "- 1 to 4 sentences; address the customer by name when it is known.\n" +
  "- Never invent status, response time, assignee, or an outcome you cannot vouch for.\n" +
  "- Mention the ticket number when available.\n" +
  "Output ONLY the JSON object described by the schema.";

/**
 * draftReplyAgent — optional, request-gated (autoReply). Falls back to
 * reply:null on any model error; the orchestrator then returns no draft.
 * A custom runStructured can be injected for tests.
 */
const draftReplyAgent = async ({ model, ctx, ticket, options = {} }) => {
  const run = options.runStructured ?? runStructured;
  const prompt = JSON.stringify({
    customerName: ctx.identity.requesterName ?? null,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    type: ticket.type,
    priority: ticket.priority,
    channel: ctx.channel,
  });
  try {
    const result = await run({
      model,
      instructions: INSTRUCTIONS,
      prompt,
      schema: ReplyDraft,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    });
    return {
      kind: "model",
      reply: result.output.reply,
      usage: result.usage,
      stepCount: result.stepCount,
    };
  } catch (error) {
    return {
      kind: "fallback",
      reply: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      stepCount: 0,
      error: error?.message ?? String(error),
    };
  }
};

module.exports = { draftReplyAgent, INSTRUCTIONS };