/**
 * AiProvider — the provider contract for the agent runtime.
 *
 * Implementations must expose:
 *   - providerId: string   (e.g. "openai-compatible", "fallback-deterministic")
 *   - model: string|null
 *   - async chat({ messages, tools, responseFormat, temperature, signal })
 *       -> Promise<NormalizedCompletion>
 *
 * NormalizedCompletion shape:
 *   {
 *     choices: [
 *       {
 *         message: {
 *           role: string,
 *           content: string | null,
 *           toolCalls: Array<{ id: string | null, name: string | null, arguments: string }>,
 *         },
 *         finishReason: string | null,
 *       },
 *     ],
 *     usage: { promptTokens: number, completionTokens: number, totalTokens: number },
 *   }
 */

class AiProvider {
  get providerId() {
    throw new Error("AiProvider subclasses must expose a providerId");
  }

  get model() {
    return null;
  }

  async chat() {
    throw new Error("AiProvider subclasses must implement chat()");
  }
}

class ProviderError extends Error {
  constructor(message, code = "PROVIDER_ERROR", status) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
  }
}

module.exports = { AiProvider, ProviderError };