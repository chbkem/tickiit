const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createEmbedder } = require("./embedder");
const {
  DEFAULT_TOP_K,
  MAX_TOP_K,
  extractKeywords,
  resolveTopK,
  cropBody,
  scoreArticle,
  mapChunkRow,
  retrieveKnowledge,
} = require("./retriever");

describe("retriever helpers", () => {
  test("extractKeywords lowercases nothing but dedupes case-insensitively", () => {
    assert.deepEqual(extractKeywords("Refund Policy refund"), ["Refund", "Policy"]);
    assert.deepEqual(extractKeywords("a b on to"), []);
    assert.deepEqual(extractKeywords(""), []);
  });

  test("extractKeywords caps the term count", () => {
    const query = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
    const terms = extractKeywords(query);
    assert.equal(terms.length, 10);
  });

  test("resolveTopK defaults and caps", () => {
    assert.equal(resolveTopK(undefined), DEFAULT_TOP_K);
    assert.equal(resolveTopK(0), DEFAULT_TOP_K);
    assert.equal(resolveTopK(-3), DEFAULT_TOP_K);
    assert.equal(resolveTopK("abc"), DEFAULT_TOP_K);
    assert.equal(resolveTopK(3), 3);
    assert.equal(resolveTopK(1000), MAX_TOP_K);
    assert.equal(resolveTopK(5.9), 5);
  });

  test("cropBody cuts long text and leaves short text alone", () => {
    assert.equal(cropBody("short text"), "short text");
    const long = "x".repeat(2000);
    const out = cropBody(long, 100);
    assert.ok(out.length <= 104);
    assert.equal(cropBody("", 100), "");
  });

  test("scoreArticle weights title and tag hits over body hits", () => {
    const article = { title: "Refund policy", body: "we talk about refunds and policy here", tags: ["refunds"] };
    assert.ok(scoreArticle(article, ["refund"]) > 0);
    assert.ok(scoreArticle(article, ["policy"]) > scoreArticle(article, ["here"]));
    assert.equal(scoreArticle(article, ["kyc"]), 0);
  });

  test("mapChunkRow maps a pgvector row to the citation shape", () => {
    const row = {
      id: "chunk_1",
      articleId: "art_1",
      index: 2,
      body: "chunk body",
      title: "Article title",
      similarity: "0.914",
    };
    assert.deepEqual(mapChunkRow(row), {
      chunkId: "chunk_1",
      articleId: "art_1",
      articleTitle: "Article title",
      index: 2,
      body: "chunk body",
      score: 0.914,
    });
  });
});

describe("retrieveKnowledge", () => {
  const makeEmbedder = ({ fail = false } = {}) => {
    let callCount = 0;
    return {
      callCount,
      getConfig: () => ({ dim: 384, modelId: "x", cacheDir: null }),
      embedText: async () => {
        if (fail) throw new Error("model unavailable");
        callCount += 1;
        return new Array(384).fill(0.01);
      },
    };
  };

  const makeDb = () => {
    const state = { queryRawCalls: [], findManyArgs: null };
    const db = {
      $queryRaw(strings, ...values) {
        state.queryRawCalls.push(values);
        return [
          { id: "c1", articleId: "a1", index: 0, body: "embedded chunk", title: "How to refund", similarity: 0.91 },
          { id: "c2", articleId: "a1", index: 1, body: "second chunk", title: "How to refund", similarity: 0.72 },
        ];
      },
      knowledgeArticle: {
        findMany: async (args) => {
          state.findManyArgs = args;
          const articles = [
            { id: "a9", title: "Refund steps", body: "To get a refund, contact support.", tags: ["refund"] },
            { id: "a2", title: "Billing", body: "Billing cycles run monthly.", tags: [] },
          ];
          return args.method === "capped" ? articles.slice(0, 1) : articles;
        },
      },
    };
    return { db, state };
  };

  test("returns empty when orgId or query is missing without touching the db", async () => {
    const { db, state } = makeDb();
    const out = await retrieveKnowledge({ orgId: "org_1", query: "", db, embedder: makeEmbedder() });
    assert.equal(out.kind, "empty");
    assert.equal(state.queryRawCalls.length, 0);
    const out2 = await retrieveKnowledge({ orgId: "", query: "hello", db, embedder: makeEmbedder() });
    assert.equal(out2.kind, "empty");
    assert.equal(state.queryRawCalls.length, 0);
  });

  test("returns empty when no keywords can be derived", async () => {
    const { db, state } = makeDb();
    const out = await retrieveKnowledge({ orgId: "org_1", query: "a b", db, embedder: makeEmbedder() });
    assert.equal(out.kind, "empty");
    assert.equal(state.queryRawCalls.length, 0);
  });

  test("semantic path returns the top chunks scoped to the org", async () => {
    const { db, state } = makeDb();
    const out = await retrieveKnowledge({ orgId: "org_1", query: "how do I refund", db, embedder: makeEmbedder() });
    assert.equal(out.kind, "semantic");
    assert.equal(out.chunks.length, 2);
    assert.equal(out.chunks[0].chunkId, "c1");
    assert.equal(out.chunks[0].articleTitle, "How to refund");
    const values = state.queryRawCalls[0];
    assert.ok(values.some((v) => v === "org_1"), "org id must be bound");
    assert.ok(values.some((v) => typeof v === "string" && v.startsWith("[0.")), "vector literal must be bound");
  });

  test("the real embedder reaches the semantic path, not the tag fallback", async () => {
    const { db, state } = makeDb();
    const embedder = createEmbedder({
      env: { AI_EMBEDDING_DIM: "384" },
      loadPipeline: async () => (texts) => ({
        tolist: () => texts.map(() => new Array(384).fill(0.01)),
      }),
    });
    const out = await retrieveKnowledge({ orgId: "org_1", query: "how do I refund", db, embedder });
    assert.equal(out.kind, "semantic", "the production embedder must satisfy the call site");
    assert.equal(state.queryRawCalls.length, 1, "the vector query must be the one that ran");
  });

  test("semantic failure falls back to tag and keyword matches", async () => {
    const { db, state } = makeDb();
    const out = await retrieveKnowledge({
      orgId: "org_1",
      query: "refund steps",
      db,
      embedder: makeEmbedder({ fail: true }),
    });
    assert.equal(out.kind, "fallback");
    assert.ok(out.chunks.length >= 1);
    assert.equal(out.chunks[0].chunkId, null);
    assert.equal(state.findManyArgs.where.orgId, "org_1");
  });

  test("semantic path with zero rows falls through to the fallback", async () => {
    const { db, state } = makeDb();
    const dbEmpty = { ...db, $queryRaw: async () => [] };
    const out = await retrieveKnowledge({ orgId: "org_1", query: "billing", db: dbEmpty, embedder: makeEmbedder() });
    assert.equal(out.kind, "fallback");
    assert.ok(state.findManyArgs.where.orgId, "org_1");
  });

  test("no matches anywhere returns an empty kind", async () => {
    const dbEmpty = {
      $queryRaw: async () => [],
      knowledgeArticle: { findMany: async () => [] },
    };
    const out = await retrieveKnowledge({ orgId: "org_1", query: "kyc onboarding", db: dbEmpty, embedder: makeEmbedder() });
    assert.equal(out.kind, "empty");
    assert.deepEqual(out.chunks, []);
  });
});