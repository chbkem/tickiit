const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_MODEL_ID,
  DEFAULT_DIM,
  createEmbedder,
  normalizeVector,
  vectorToLiteral,
  assertDimension,
} = require("./embedder");

describe("embedder vector helpers", () => {
  test("normalizeVector produces a unit length vector", () => {
    const vec = normalizeVector([3, 0, 4]);
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    assert.ok(Math.abs(norm - 1) < 1e-9);
    assert.ok(Math.abs(vec[0] - 0.6) < 1e-9);
    assert.equal(vec[1], 0);
    assert.ok(Math.abs(vec[2] - 0.8) < 1e-9);
  });

  test("normalizeVector keeps a zero vector as zeros without NaN", () => {
    const vec = normalizeVector([0, 0, 0]);
    assert.deepEqual(vec, [0, 0, 0]);
    for (const v of vec) assert.ok(Number.isFinite(v));
  });

  test("vectorToLiteral formats a pgvector literal", () => {
    assert.equal(vectorToLiteral([0.1, 0.2, 300]), "[0.1,0.2,300]");
    assert.equal(vectorToLiteral([]), "[]");
  });

  test("assertDimension accepts a match and rejects a mismatch", () => {
    assert.deepEqual(assertDimension([1, 2, 3], 3), [1, 2, 3]);
    assert.throws(() => assertDimension([1, 2], 384), /dimension is 2.*expects 384/i);
  });
});

describe("createEmbedder", () => {
  test("defaults to the spec model id and dimension", () => {
    const embedder = createEmbedder({ env: {} });
    assert.equal(embedder.config.modelId, DEFAULT_MODEL_ID);
    assert.equal(embedder.config.dim, DEFAULT_DIM);
    assert.equal(embedder.config.cacheDir, null);
  });

  test("honors configured model, dimension, and cache dir", () => {
    const embedder = createEmbedder({
      env: {
        AI_EMBEDDING_MODEL: "org/some-model",
        AI_EMBEDDING_DIM: "512",
        AI_EMBEDDING_CACHE_DIR: "./weights",
      },
    });
    assert.equal(embedder.config.modelId, "org/some-model");
    assert.equal(embedder.config.dim, 512);
    assert.equal(embedder.config.cacheDir, "./weights");
  });

  test("falls back to defaults for empty or invalid dimension env values", () => {
    const embedder = createEmbedder({ env: { AI_EMBEDDING_DIM: "abc" } });
    assert.equal(embedder.config.dim, DEFAULT_DIM);
  });

  test("exposes getConfig, the accessor every call site uses", () => {
    const embedder = createEmbedder({ env: { AI_EMBEDDING_MODEL: "org/some-model", AI_EMBEDDING_DIM: "512" } });
    assert.equal(typeof embedder.getConfig, "function");
    assert.equal(embedder.getConfig().modelId, "org/some-model");
    assert.equal(embedder.getConfig().dim, 512);
  });

  test("embedTexts passes an array through and returns one vector per text", async () => {
    let receivedTexts = null;
    const embedder = createEmbedder({
      env: { AI_EMBEDDING_DIM: "384" },
      loadPipeline: async () => (texts, options) => {
        receivedTexts = texts;
        assert.deepEqual(options, { pooling: "mean", normalize: true });
        return { tolist: () => texts.map((_, i) => new Array(384).fill(i)) };
      },
    });
    const vectors = await embedder.embedTexts(["first", "second"]);
    assert.deepEqual(receivedTexts, ["first", "second"]);
    assert.equal(vectors.length, 2);
    assert.equal(vectors[0].length, 384);
    assert.equal(embedder.isReady(), true);
  });

  test("embedText returns the first embedding of a single text", async () => {
    const embedder = createEmbedder({
      env: {},
      loadPipeline: async () => (texts) => ({ tolist: () => [new Array(384).fill(0.5)] }),
    });
    const vec = await embedder.embedText("hello knowledge");
    assert.equal(vec.length, 384);
    assert.equal(vec[0], 0.5);
  });

  test("a failed model load is sticky and never retried", async () => {
    let loadCalls = 0;
    const embedder = createEmbedder({
      env: {},
      loadPipeline: async () => {
        loadCalls += 1;
        throw new Error("weights download failed");
      },
    });
    await assert.rejects(() => embedder.load(), /weights download failed/);
    await assert.rejects(() => embedder.load(), /weights download failed/);
    await assert.rejects(() => embedder.embedTexts(["x"]), /weights download failed/);
    assert.equal(loadCalls, 1, "the pipeline factory must only run once");
    assert.equal(embedder.isReady(), false);
    assert.match(embedder.getError().message, /weights download failed/);
  });

  test("empty text list embeds nothing and does not load the model", async () => {
    let loadCalls = 0;
    const embedder = createEmbedder({
      env: {},
      loadPipeline: async () => {
        loadCalls += 1;
        return () => ({ tolist: () => [] });
      },
    });
    assert.deepEqual(await embedder.embedTexts([]), []);
    assert.equal(loadCalls, 0);
    assert.equal(embedder.isReady(), false);
  });
});