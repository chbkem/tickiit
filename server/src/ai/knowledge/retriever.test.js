const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { KeywordKnowledgeRetriever, KnowledgeRetriever, clampLimit, termsOf, DEFAULT_LIMIT } = require("./retriever");

const article = (overrides = {}) => ({
  id: `a-${Math.random().toString(36).slice(2, 8)}`,
  title: "Password reset flow",
  body: "The reset email is sent to the primary address within a minute.",
  tags: ["auth", "password"],
  source: "ops-wiki",
  updatedAt: new Date("2026-01-10T00:00:00Z"),
  ...overrides,
});

const makeRetriever = (script) => {
  const calls = [];
  const prisma = {
    knowledgeArticle: {
      findMany: async (args) => {
        calls.push(args);
        const results = typeof script === "function" ? script(args) : script;
        return results ?? [];
      },
    },
  };
  return { retriever: new KeywordKnowledgeRetriever({ prisma }), calls };
};

describe("KeywordKnowledgeRetriever", () => {
  test("search({}) with an empty query returns no hits and never queries the store", async () => {
    const { retriever, calls } = makeRetriever(() => {
      throw new Error("should not be called");
    });
    const out = await retriever.search({ orgId: "org_1", query: "   ", limit: 5 });
    assert.equal(out.hits.length, 0);
    assert.equal(out.hitCount, 0);
    assert.deepEqual(out.orgId, "org_1");
    assert.equal(calls.length, 0);
  });

  test("scopes the where clause to the org and global (orgId null) articles", async () => {
    const { retriever, calls } = makeRetriever([]);
    await retriever.search({ orgId: "org_1", query: "reset email" });
    const where = calls[0].where;
    assert.deepEqual(where.AND[0], { OR: [{ orgId: "org_1" }, { orgId: null }] });
    assert.equal(calls[0].orderBy.updatedAt, "desc");
    assert.equal(typeof calls[0].take, "number");
  });

  test("scopes to global-only when orgId is null", async () => {
    const { retriever, calls } = makeRetriever([]);
    await retriever.search({ orgId: null, query: "reset" });
    assert.deepEqual(calls[0].where.AND[0], { orgId: null });
  });

  test("builds an OR of per-term matchers across title/body/tags", async () => {
    const { retriever, calls } = makeRetriever([]);
    await retriever.search({ orgId: null, query: "reset email" });
    const termsOr = calls[0].where.AND[1].OR;
    assert.equal(termsOr.length, 2);
    const matchers = termsOr[0].OR;
    assert.equal(matchers.length, 3);
    assert.deepEqual(Object.keys(matchers[0]), ["title"]);
    assert.equal(matchers[0].title.mode, "insensitive");
    assert.deepEqual(Object.keys(matchers[1]), ["body"]);
    assert.deepEqual(Object.keys(matchers[2]), ["tags"]);
    assert.deepEqual(matchers[2].tags, { has: "reset" });
  });

  test("ranks title hits above tag hits above body hits and labels relevance", async () => {
    const titleHit = article({ id: "cpu", title: "CPU fan overheating guide", tags: ["hardware"], body: "nothing here" });
    const tagHit = article({ id: "mem", title: "Hardware guide", tags: ["cpu"], body: "unrelated", updatedAt: new Date("2026-01-09T00:00:00Z") });
    const bodyHit = article({ id: "disk", title: "Unrelated", tags: [], body: "the cpu was reset at reboot", updatedAt: new Date("2026-01-08T00:00:00Z") });
    const { retriever } = makeRetriever([titleHit, tagHit, bodyHit]);
    const out = await retriever.search({ orgId: null, query: "cpu", limit: 5 });
    assert.deepEqual(
      out.hits.map((h) => h.id),
      ["cpu", "mem", "disk"],
    );
    assert.equal(out.hits[0].relevance, "high");
    assert.equal(out.hits[1].relevance, "medium");
    assert.equal(out.hits[2].relevance, "low");
  });

  test("sorts by score then recency and clips to limit", async () => {
    const a = article({ id: "a", title: "VPN docs", body: "setup steps for vpn", updatedAt: new Date("2026-01-01T00:00:00Z") });
    const b = article({ id: "b", title: "VPN", body: "vpn", updatedAt: new Date("2026-01-02T00:00:00Z") });
    const { retriever } = makeRetriever([a, b]);
    const out = await retriever.search({ orgId: null, query: "vpn", limit: 1 });
    assert.equal(out.hits.length, 1);
    assert.match(out.hits[0].id, /^(a|b)$/);
  });

  test("sanitizes and caps output strings and builds a match-aware snippet", async () => {
    const hostile = article({ body: "<script>alert(1)</script> the password reset link arrives in five minutes", tags: ["<b>auth</b>"] });
    const { retriever } = makeRetriever([hostile]);
    const out = await retriever.search({ orgId: null, query: "arrives", limit: 5 });
    const hit = out.hits[0];
    assert.equal(hit.snippet.includes("<script>"), false);
    assert.equal(hit.tags.includes("<b>auth</b>"), false);
    assert.equal(hit.snippet.includes("arrives"), true);
  });

  test("clampLimit and termsOf helpers behave", () => {
    assert.equal(clampLimit(undefined), DEFAULT_LIMIT);
    assert.equal(clampLimit(0), DEFAULT_LIMIT);
    assert.equal(clampLimit(3), 3);
    assert.equal(clampLimit(50), 10);
    assert.deepEqual(termsOf("  reset   email "), ["reset", "email"]);
    assert.deepEqual(termsOf(""), []);
  });
});

describe("KnowledgeRetriever interface", () => {
  test("base class search() is not implemented", async () => {
    await assert.rejects(new KnowledgeRetriever().search(), /must be implemented/);
  });
});