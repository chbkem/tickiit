const { parseTriageResponse } = require("../contracts/triageDecision");
const { FallbackDeterministicProvider } = require("../providers/fallbackEngine");

const formatIssues = (error) =>
  (Array.isArray(error?.issues) ? error.issues : [])
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");

/**
 * Decider — validates the agent's structured output, produces a repair hint for
 * the loop's single repair turn, and provides the deterministic fallback used
 * when the loop exhausts turns, emits garbage, or the provider fails.
 *
 * Confidence gating and circuit breaking are NOT here — those belong to the
 * worker pipeline (build step 6); the runtime stays threshold-agnostic.
 */
class Decider {
  constructor({ fallbackProvider } = {}) {
    this.fallbackProvider = fallbackProvider ?? new FallbackDeterministicProvider();
  }

  validate(value) {
    return parseTriageResponse(value);
  }

  validationHint(error) {
    const issues = formatIssues(error);
    return (
      `Your previous response failed validation (${issues || "not a valid JSON object"}). ` +
      `Respond with ONLY a single valid JSON object shaped as ` +
      `{"decision": {subject, type, priority, assigneeRef, rationale}, "confidence": {score, label?, reasoning?, signals?}}. ` +
      `No tool calls, no markdown fences.`
    );
  }

  fallback({ subject, body }) {
    return this.fallbackProvider.decide({ subject, body });
  }
}

module.exports = { Decider, formatIssues };