const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry } = require("./registry");
const { knowledgeSearchTool, KnowledgeSearchInput, DEFAULT_SEARCH_LIMIT } = require("./knowledgeSearch");

const runTool = async (tool, args, ctx = {}) => {
  const registry = new ToolRegistry([tool]);
  return registry.execute(tool.name, args, ctx);
};

describe("knowledgeSearch tool", () => {
  test("passes org, query, and default limit to the retriever", async () => {
    let received = null;
    const retriever = {
      search: async (args) => {
        received = args;
        return { query: args.query, orgId: args.orgId, hits: [], hitCount: 0 };
      },
    };
    const out = await runTool(knowledgeSearchTool({ knowledgeRetriever: retriever }), { query: "reset password" }, { orgId: "org_1" });
    assert.equal(out.ok, true);
    assert.equal(out.kind, "read");
    assert.deepEqual(received, { orgId: "org_1", query: "reset password", limit: DEFAULT_SEARCH_LIMIT });
  });

  test("passes an explicit limit through and forwards retriever hits", async () => {
    const hits = [{ id: "a-1", title: "Reset flow", snippet: "…", tags: [], source: "wiki", relevance: "high" }];
    const retriever = { search: async (args) => ({ query: args.query, orgId: args.orgId, hits, hitCount: 1 }) };
    const out = await runTool(knowledgeSearchTool({ knowledgeRetriever: retriever }), { query: "reset", limit: 3 }, { task: { orgId: "org_2" } });
    assert.equal(out.ok, true);
    assert.deepEqual(out.result.hits, hits);
    assert.equal(out.result.hitCount, 1);
  });

  test("missing retriever degrades to an empty hit set", async () => {
    const out = await runTool(knowledgeSearchTool({}), { query: "reset" }, {});
    assert.equal(out.ok, true);
    assert.deepEqual(out.result.hits, []);
    assert.match(out.result.note, /unavailable/);
  });

  test("input schema is strict and validates query/limit", () => {
    assert.equal(KnowledgeSearchInput.safeParse({ query: "reset" }).success, true);
    assert.equal(KnowledgeSearchInput.safeParse({ query: "  " }).success, false);
    assert.equal(KnowledgeSearchInput.safeParse({ query: "reset", limit: 0 }).success, false);
    assert.equal(KnowledgeSearchInput.safeParse({ query: "reset", limit: 20 }).success, false);
    assert.equal(KnowledgeSearchInput.safeParse({ query: "reset", extra: 1 }).success, false);
  });
});