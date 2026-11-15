const DEFAULT_MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const DEFAULT_DIM = 384;

const normalizeVector = (values) => {
  const vec = Array.from(values || []);
  let norm = 0;
  for (const value of vec) norm += value * value;
  norm = Math.sqrt(norm);
  if (!norm || !Number.isFinite(norm)) return vec.map(() => 0);
  const inverse = 1 / norm;
  return vec.map((value) => value * inverse);
};

const vectorToLiteral = (vec) => `[${Array.from(vec || []).join(",")}]`;

const assertDimension = (vec, expected) => {
  const actual = vec.length;
  if (actual !== expected) {
    throw new Error(
      `Embedding dimension is ${actual} but the vector column expects ${expected}. ` +
        `Check AI_EMBEDDING_MODEL matches AI_EMBEDDING_DIM.`,
    );
  }
  return vec;
};

const createEmbedder = ({ env = process.env, loadPipeline } = {}) => {
  const config = {
    modelId: String(env.AI_EMBEDDING_MODEL || DEFAULT_MODEL_ID).trim() || DEFAULT_MODEL_ID,
    dim: Number.parseInt(env.AI_EMBEDDING_DIM || "", 10) || DEFAULT_DIM,
    cacheDir: env.AI_EMBEDDING_CACHE_DIR || null,
  };

  let extractorPromise = null;
  let ready = false;
  let lastError = null;

  const load = () => {
    if (extractorPromise) return extractorPromise;
    extractorPromise = (async () => {
      let extractor;
      if (loadPipeline) {
        extractor = await loadPipeline(config);
      } else {
        const { pipeline: createPipeline } = require("@huggingface/transformers");
        const options = { device: "cpu", dtype: "fp32" };
        if (config.cacheDir) options.cache_dir = config.cacheDir;
        extractor = await createPipeline("feature-extraction", config.modelId, options);
      }
      ready = true;
      return extractor;
    })();
    extractorPromise.catch((err) => {
      lastError = err;
    });
    return extractorPromise;
  };

  const isReady = () => ready;

  const getError = () => lastError;

  const getConfig = () => config;

  const embedTexts = async (texts) => {
    const items = (Array.isArray(texts) ? texts : [texts]).map(String).filter((t) => t.length > 0);
    if (!items.length) return [];
    const extractor = await load();
    const output = await extractor(items, { pooling: "mean", normalize: true });
    if (typeof output.tolist === "function") return output.tolist();
    if (Array.isArray(output)) return output;
    throw new Error("The embedding model returned an unexpected output shape.");
  };

  const embedText = async (text) => {
    const vectors = await embedTexts(String(text));
    return vectors[0] || [];
  };

  return {
    config,
    getConfig,
    load,
    isReady,
    getError,
    embedTexts,
    embedText,
  };
};

let singleton = null;

const getEmbedder = (opts) => {
  if (!singleton) singleton = createEmbedder(opts);
  return singleton;
};

module.exports = {
  DEFAULT_MODEL_ID,
  DEFAULT_DIM,
  createEmbedder,
  getEmbedder,
  normalizeVector,
  vectorToLiteral,
  assertDimension,
};