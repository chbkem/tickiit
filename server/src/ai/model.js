const { google } = require("@ai-sdk/google");

const DEFAULT_MODEL = "gemini-3.8-flash";
const SUPPORTED_PROVIDERS = Object.freeze(["gemini"]);

const normalizeProvider = (raw) => String(raw ?? "").trim().toLowerCase() || "gemini";

/**
 * createModel — provider/model factory for the triage agents.
 *
 * v1 only supports Gemini via @ai-sdk/google. Later frontier/local providers
 * (e.g. an OpenAI-compatible endpoint) plug in here behind the same return
 * shape (an AI SDK language model), without touching any agent code.
 *
 * Throws a descriptive error when the configuration is unusable; the
 * orchestrator catches it and degrades to deterministic creation.
 */
const createModel = ({ env = process.env, modelId, provider } = {}) => {
  const name = normalizeProvider(provider ?? env.AI_PROVIDER);
  if (name === "gemini") {
    const id = String(modelId ?? env.AI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
    const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing Google API key. Set GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY.");
    }
    return google(id, apiKey ? { apiKey } : undefined);
  }
  throw new Error(
    `Unsupported AI_PROVIDER "${name}". Supported providers: ${SUPPORTED_PROVIDERS.join(", ")}.`,
  );
};

module.exports = { createModel, DEFAULT_MODEL, SUPPORTED_PROVIDERS };