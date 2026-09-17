const { isStepCount, hasToolCall } = require("ai");
const { runToolLoop } = require("../agent/runAgent");
const { createTools } = require("../tools");

const DEFAULT_MAX_STEPS = 5;
const DEFAULT_TEMPERATURE = 0.2;

const INSTRUCTIONS =
  "You are the ticket creation agent of a ticketing triage pipeline. Persist the provided classified ticket exactly once by calling create_ticket.\n" +
  "Rules:\n" +
  "- subject, description, type and priority must match the provided draft exactly — never invent details.\n" +
  "- You may call list_tickets, get_ticket or list_agents first for context, but you must still create the ticket.\n" +
  "- Do not assign anyone; assignment is never done by this system.\n" +
  "- Call create_ticket once, then stop.";

/**
 * createTicketAgent — runs the create agent with the read + create toolset.
 * Always returns without throwing. If the model called create_ticket, the
 * bound createTicket already persisted state.ticket (via ctx.createTicket)
 * and it is returned; otherwise the caller persists the deterministic
 * fallback draft itself.
 */
const createTicketAgent = async ({ model, ctx, state, classified, prioritized, options = {} }) => {
  const run = options.runToolLoop ?? runToolLoop;
  const tools = createTools({ ctx });
  const prompt = JSON.stringify({
    draft: {
      subject: classified.subject,
      description: classified.description ?? null,
      type: classified.type,
      priority: prioritized.priority,
    },
  });
  try {
    const result = await run({
      model,
      instructions: INSTRUCTIONS,
      prompt,
      tools,
      stopWhen: [
        hasToolCall("create_ticket"),
        isStepCount(options.maxSteps ?? DEFAULT_MAX_STEPS),
      ],
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    });
    return {
      kind: state.ticket ? "model" : "fallback",
      ticket: state.ticket ?? null,
      usage: result.usage,
      stepCount: result.stepCount,
      toolCalls: result.toolCalls,
    };
  } catch (error) {
    return {
      kind: "fallback",
      ticket: state.ticket ?? null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      stepCount: 0,
      toolCalls: [],
      error: error?.message ?? String(error),
    };
  }
};

module.exports = { createTicketAgent, INSTRUCTIONS, DEFAULT_MAX_STEPS };