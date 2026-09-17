const { AiProvider, ProviderError } = require("./aiProvider");

const CHAT_COMPLETIONS_PATH = "/chat/completions";
const DEFAULT_TIMEOUT_MS = 15000;

const joinUrl = (base, path) => String(base).replace(/\/+$/, "") + path;

const normalizeUsage = (usage) => {
  if (!usage || typeof usage !== "object") {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
};

const normalizeMessage = (message = {}) => {
  const content =
    message.content == null ? null : typeof message.content === "string" ? message.content : JSON.stringify(message.content);
  const toolCalls = Array.isArray(message.tool_calls)
    ? message.tool_calls.map((tc) => ({
        id: tc.id ?? null,
        name: tc.function?.name ?? null,
        arguments: typeof tc.function?.arguments === "string" ? tc.function.arguments : "{}",
      }))
    : [];
  return { role: message.role ?? "assistant", content, toolCalls };
};

const normalizeCompletion = (raw) => ({
  choices: Array.isArray(raw.choices)
    ? raw.choices.map((c) => ({
        message: normalizeMessage(c.message),
        finishReason: c.finish_reason ?? null,
      }))
    : [],
  usage: normalizeUsage(raw.usage),
  raw,
});

class OpenAICompatibleProvider extends AiProvider {
  constructor(options = {}) {
    super();
    const env = options.env ?? process.env;
    this.baseUrl = options.baseUrl ?? env.AI_BASE_URL;
    this.apiKey = options.apiKey ?? env.AI_API_KEY;
    this._model = options.model ?? env.AI_MODEL;
    this.timeoutMs = options.timeoutMs ?? Number(env.AI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this._fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  get providerId() {
    return "openai-compatible";
  }

  get model() {
    return this._model;
  }

  async chat({ messages, tools, responseFormat, temperature, signal } = {}) {
    if (!Array.isArray(messages)) throw new TypeError("chat({ messages }) must be an array");
    if (!this.baseUrl) throw new ProviderError("AI_BASE_URL is not configured");
    if (!this._model) throw new ProviderError("AI_MODEL is not configured");

    const body = { model: this._model, messages };
    if (temperature !== undefined) body.temperature = temperature;
    if (Array.isArray(tools) && tools.length > 0) body.tools = tools;
    if (responseFormat !== undefined) body.response_format = responseFormat;

    const headers = { "content-type": "application/json" };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const abortSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

    try {
      const res = await this._fetchFn(joinUrl(this.baseUrl, CHAT_COMPLETIONS_PATH), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortSignal,
      });

      if (!res.ok) {
        const detail = (await res.text()).slice(0, 2000);
        throw new ProviderError(`provider returned HTTP ${res.status}: ${detail}`, "HTTP_ERROR", res.status);
      }

      const raw = await res.json();
      return normalizeCompletion(raw);
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err?.name === "AbortError") {
        if (controller.signal.aborted) throw new ProviderError("provider request timed out", "TIMEOUT");
        throw new ProviderError("provider request aborted", "ABORTED");
      }
      throw new ProviderError(`provider request failed: ${err.message}`, "NETWORK");
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { OpenAICompatibleProvider, normalizeCompletion, joinUrl };