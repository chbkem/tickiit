const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const ApiError = require("../../utils/ApiError");
const {
  ingestArticle,
  listArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  listChunksByArticle,
} = require("./knowledgeService");

const makeEmbedder = ({ vectors = [[1, 0], [0, 1]], error = null, dim } = {}) => {
  let calls = 0;
  return {
    calls: () => calls,
    getConfig: () => ({ dim: dim ?? (Array.isArray(vectors[0]) ? vectors[0].length : 0) }),
    embedTexts: async () => {
      calls += 1;
      if (error) throw error;
      return vectors;
    },
  };
};

const makeTx = () => {
  const inserts = [];
  const deletes = [];
  const tx = {
    inserts,
    deletes,
    knowledgeChunk: {
      deleteMany: async ({ where }) => {
        deletes.push(where);
      },
    },
  };
  tx.$executeRaw = (strings, ...values) => {
    inserts.push(values);
    return Promise.resolve();
  };
  return tx;
};

const makeDb = (tx) => ({
  knowledgeChunk: {
    findMany: async () => [],
  },
  $transaction: async (fn) => fn(tx),
});

const makeArticleDb = ({ articles = [], failChunkInsert = false, staleUpdate = false } = {}) => {
  let state = { articles: structuredClone(articles) };
  let chunkInserts = 0;
  let chunkDeletes = 0;

  const matches = (row, where) =>
    Object.entries(where).every(([key, value]) => {
      if (value instanceof Date) return row[key] instanceof Date && row[key].getTime() === value.getTime();
      return row[key] === value;
    });

  const makeClient = (draft) => ({
    knowledgeArticle: {
      create: async ({ data }) => {
        const row = { tags: [], ...data };
        draft.articles.push(row);
        return row;
      },
      findFirst: async ({ where }) => draft.articles.find((row) => matches(row, where)) ?? null,
      findMany: async ({ where, orderBy }) => {
        const rows = draft.articles.filter((row) => matches(row, where));
        if (orderBy?.updatedAt === "desc") rows.reverse();
        return rows;
      },
      update: async ({ where, data }) => {
        const index = draft.articles.findIndex((row) => matches(row, where));
        draft.articles[index] = { ...draft.articles[index], ...data };
        return draft.articles[index];
      },
      updateMany: async ({ where, data }) => {
        if (staleUpdate) return { count: 0 };
        const index = draft.articles.findIndex((row) => matches(row, where));
        if (index === -1) return { count: 0 };
        const current = draft.articles[index];
        draft.articles[index] = {
          ...current,
          ...data,
          updatedAt:
            current.updatedAt instanceof Date
              ? new Date(current.updatedAt.getTime() + 1)
              : current.updatedAt,
        };
        return { count: 1 };
      },
      deleteMany: async ({ where }) => {
        const before = draft.articles.length;
        draft.articles = draft.articles.filter((row) => !matches(row, where));
        return { count: before - draft.articles.length };
      },
    },
    knowledgeChunk: {
      deleteMany: async () => {
        chunkDeletes += 1;
        return { count: 1 };
      },
    },
    $executeRaw: async () => {
      if (failChunkInsert) throw new Error("chunk insert failed");
      chunkInserts += 1;
    },
  });

  const db = {
    get knowledgeArticle() {
      return makeClient(state).knowledgeArticle;
    },
    $transaction: async (fn) => {
      const draft = structuredClone(state);
      const result = await fn(makeClient(draft));
      state = draft;
      return result;
    },
  };

  return {
    db,
    articles: () => structuredClone(state.articles),
    chunkInserts: () => chunkInserts,
    chunkDeletes: () => chunkDeletes,
  };
};

describe("ingestArticle", () => {
  test("rejects an article that is over the chunk cap without embedding", async () => {
    const body = Array.from({ length: 1100 }, () => "x".repeat(1000)).join("\n");
    const embedder = makeEmbedder();
    const db = makeDb(makeTx());
    await assert.rejects(
      ingestArticle({ article: { id: "a1", orgId: "org_1", body }, embedder, db }),
      (err) => err instanceof ApiError && err.statusCode === 422,
    );
    assert.equal(embedder.calls(), 0);
  });

  test("normalizes vectors before writing them", async () => {
    const article = { id: "a1", orgId: "org_1", body: "Only one paragraph here" };
    const tx = makeTx();
    const db = makeDb(tx);
    const embedder = makeEmbedder({ vectors: [[3, 4]] });
    const result = await ingestArticle({ article, embedder, db });
    assert.equal(result.embedded, true);
    const written = JSON.parse(tx.inserts[0][4]);
    assert.ok(Math.abs(written[0] - 0.6) < 1e-9, `expected a normalized first component, got ${written[0]}`);
    assert.ok(Math.abs(written[1] - 0.8) < 1e-9, `expected a normalized second component, got ${written[1]}`);
  });

  test("a dimension mismatch degrades to null embeddings instead of writing a bad vector", async () => {
    const article = { id: "a1", orgId: "org_1", body: "Alpha notes\n\nBeta logs" };
    const tx = makeTx();
    const db = makeDb(tx);
    const embedder = makeEmbedder({ vectors: [[1, 0], [0, 1]], dim: 384 });
    const result = await ingestArticle({ article, embedder, db });
    assert.equal(result.embedded, false);
    assert.equal(result.chunkCount, tx.inserts.length);
    for (const values of tx.inserts) {
      assert.equal(values[4], null);
    }
  });

  test("stores chunks without embeddings when the embedder is unavailable", async () => {
    const article = { id: "a1", orgId: "org_1", body: "Alpha notes\n\nBeta logs" };
    const tx = makeTx();
    const db = makeDb(tx);
    const embedder = makeEmbedder({ error: new Error("model offline") });
    const result = await ingestArticle({ article, embedder, db });
    assert.equal(result.chunkCount, tx.inserts.length);
    assert.equal(result.embedded, false);
    assert.deepEqual(tx.deletes, [{ articleId: "a1" }]);
    for (const values of tx.inserts) {
      assert.equal(values[4], null);
      assert.equal(values[1], "a1");
    }
  });

  test("embeds each chunk and writes vector literals in the same transaction", async () => {
    const article = { id: "a1", orgId: "org_1", body: "Alpha notes\n\nBeta logs" };
    const tx = makeTx();
    const db = makeDb(tx);
    const embedder = makeEmbedder({ vectors: [[1, 0], [0, 1]] });
    const result = await ingestArticle({ article, embedder, db });
    assert.equal(result.embedded, true);
    assert.equal(result.chunkCount, 2);
    const literals = tx.inserts.map((values) => values[4]);
    assert.deepEqual(literals, ["[1,0]", "[0,1]"]);
    assert.deepEqual(tx.deletes, [{ articleId: "a1" }]);
  });
});

describe("article CRUD", () => {
  test("listArticles scopes the query to the org and orders by recency", async () => {
    let captured = null;
    const db = {
      knowledgeArticle: {
        findMany: async (args) => {
          captured = args;
          return [];
        },
      },
    };
    await listArticles({ orgId: "org_9", db });
    assert.deepEqual(captured.where, { orgId: "org_9" });
    assert.deepEqual(captured.orderBy, { updatedAt: "desc" });
    await assert.rejects(listArticles({ db }), ApiError);
  });

  test("createArticle writes the article and its chunks in one transaction", async () => {
    const store = makeArticleDb();
    const embedder = makeEmbedder({ vectors: [[1, 0], [0, 1]] });
    const article = await createArticle({
      actorId: "user_1",
      data: {
        orgId: "org_1",
        title: "Refunds",
        body: "Alpha notes\n\nBeta logs",
        source: "ARTICLE",
        tags: ["billing"],
      },
      embedder,
      db: store.db,
    });

    assert.equal(article.orgId, "org_1");
    assert.equal(store.articles().length, 1);
    assert.equal(store.chunkInserts(), 2);
    assert.equal(store.chunkDeletes(), 1);
  });

  test("createArticle leaves nothing behind when a chunk insert fails", async () => {
    const store = makeArticleDb({ failChunkInsert: true });
    const embedder = makeEmbedder({ vectors: [[1, 0], [0, 1]] });
    await assert.rejects(
      createArticle({
        data: { orgId: "org_1", title: "Refunds", body: "Alpha notes\n\nBeta logs", tags: [] },
        embedder,
        db: store.db,
      }),
      /chunk insert failed/,
    );
    assert.equal(store.articles().length, 0);
  });

  test("updateArticle re-ingests the effective body and replaces every chunk", async () => {
    const store = makeArticleDb({
      articles: [{ id: "a1", orgId: "org_1", title: "Old", body: "Alpha notes\n\nBeta logs", tags: [] }],
    });
    const embedder = makeEmbedder({ vectors: [[1, 0], [0, 1]] });
    const article = await updateArticle({
      id: "a1",
      orgId: "org_1",
      data: { title: "New" },
      embedder,
      db: store.db,
    });

    assert.equal(article.title, "New");
    assert.equal(store.chunkInserts(), 2);
    assert.equal(store.chunkDeletes(), 1);
  });

  test("updateArticle returns 404 for an article in another org", async () => {
    const store = makeArticleDb({
      articles: [{ id: "a1", orgId: "org_1", title: "Old", body: "Alpha notes", tags: [] }],
    });
    const embedder = makeEmbedder({ vectors: [[1, 0]] });
    await assert.rejects(
      updateArticle({ id: "a1", orgId: "org_2", data: { title: "New" }, embedder, db: store.db }),
      (err) => err instanceof ApiError && err.statusCode === 404,
    );
    assert.equal(store.articles()[0].title, "Old");
    assert.equal(store.chunkInserts(), 0);
  });

  test("updateArticle returns 409 when another edit won the race", async () => {
    const updatedAt = new Date("2026-01-01T00:00:00.000Z");
    const store = makeArticleDb({
      staleUpdate: true,
      articles: [{ id: "a1", orgId: "org_1", title: "Old", body: "Alpha notes", tags: [], updatedAt }],
    });
    const embedder = makeEmbedder({ vectors: [[1, 0]] });
    await assert.rejects(
      updateArticle({ id: "a1", orgId: "org_1", data: { title: "New" }, embedder, db: store.db }),
      (err) => err instanceof ApiError && err.statusCode === 409 && /changed while/.test(err.message),
    );
    assert.equal(store.articles()[0].title, "Old");
    assert.equal(store.chunkInserts(), 0);
  });

  test("deleteArticle removes only the org's article and cascades through the database", async () => {
    const store = makeArticleDb({
      articles: [{ id: "a1", orgId: "org_1", title: "Old", body: "Alpha", tags: [] }],
    });
    await assert.rejects(
      deleteArticle({ id: "a1", orgId: "org_2", db: store.db }),
      (err) => err instanceof ApiError && err.statusCode === 404,
    );
    assert.equal(store.articles().length, 1);

    await deleteArticle({ id: "a1", orgId: "org_1", db: store.db });
    assert.equal(store.articles().length, 0);
  });
});

describe("listChunksByArticle", () => {
  test("scopes the read to the org through the article relation", async () => {
    let captured = null;
    const db = {
      knowledgeChunk: {
        findMany: async (args) => {
          captured = args;
          return [];
        },
      },
    };
    await listChunksByArticle({ orgId: "org_9", articleId: "a1", db });
    assert.equal(captured.where.articleId, "a1");
    assert.equal(captured.where.article.orgId, "org_9");
    assert.equal(captured.orderBy.index, "asc");
    assert.deepEqual(Object.keys(captured.select), ["id", "index", "body"]);
  });

  test("rejects when org or article id is missing", async () => {
    const db = makeDb(makeTx());
    await assert.rejects(listChunksByArticle({ orgId: "org_9", db }), ApiError);
    await assert.rejects(listChunksByArticle({ articleId: "a1", db }), ApiError);
  });
});