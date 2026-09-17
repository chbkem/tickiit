const DEFAULT_MAX_TOKENS = 4000;
const TRUNCATION_MARKER = "[truncated]";

const contentOf = (message) => {
  const value = message?.content;
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

// Cheap heuristic: ~4 chars per token. Good enough for budget enforcement.
const estimateTokens = (value) => Math.ceil((value ?? "").length / 4);

/**
 * MessageBuffer — short-term task window with a token budget.
 *
 * Eviction (oldest consumed tool results first) preserves the system prompt and
 * the initial user (task) message — those are the anchors the loop needs — and
 * replaces tool result bodies with a truncation marker so the provider schema
 * stays well-formed (tool messages keep their tool_call_id).
 */
class MessageBuffer {
  constructor({ maxTokens } = {}) {
    this.maxTokens = maxTokens ?? Number(process.env.AI_MAX_CONTEXT_TOKENS ?? DEFAULT_MAX_TOKENS);
    this._messages = [];
  }

  get messages() {
    return this._messages;
  }

  get length() {
    return this._messages.length;
  }

  get estimatedTokens() {
    return this._messages.reduce((acc, m) => acc + estimateTokens(contentOf(m)), 0);
  }

  push(message) {
    if (!message || typeof message !== "object") throw new TypeError("message must be an object");
    this._messages.push(message);
    this._enforceBudget();
    return message;
  }

  replaceLast(message) {
    if (this._messages.length === 0) return this.push(message);
    this._messages[this._messages.length - 1] = message;
    this._enforceBudget();
    return message;
  }

  _enforceBudget() {
    while (this.estimatedTokens > this.maxTokens) {
      const idx = this._messages.findIndex(
        (m, i) => i > 1 && m.role === "tool" && contentOf(m) !== TRUNCATION_MARKER,
      );
      if (idx === -1) break;
      this._messages[idx] = { ...this._messages[idx], content: TRUNCATION_MARKER };
    }
  }
}

module.exports = { MessageBuffer, estimateTokens, TRUNCATION_MARKER };