const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry } = require("./registry");
const { createContextTools } = require("./index");

const deps = {
  requesterStore: {
    getRequesterContext: async ({ requesterRef }) => ({
      requester: { ref: requesterRef, name: "Ada" },
      openTicketCount: 0,
      totalTicketCount: 1,
      recentTickets: [],
    }),
  },
  knowledgeRetriever: {
    search: async ({ query }) => ({ query, orgId: null, hits: [], hitCount: 0 }),
  },
  agentPoolService: {
    listAssignableAgents: async () => [{ ref: "user_free", name: "A", role: "agent", openTicketCount: 0 }],
  },
  orgPolicyService: {
    getOrgPolicy: async () => ({ orgName: "Acme", policy: { defaultPriority: "MEDIUM" } }),
  },
};

describe("createContextTools", () => {
  test("assembles the four read tools with expected names and kinds", () => {
    const tools = createContextTools(deps);
    assert.deepEqual(
      tools.map((t) => t.name),
      ["get_requester_context", "search_knowledge", "list_assignable_agents", "get_org_policy"],
    );
    for (const tool of tools) {
      assert.equal(tool.kind, "read");
      assert.equal(typeof tool.description, "string");
      assert.equal(typeof tool.run, "function");
    }
  });

  test("all four execute through the ToolRegistry", async () => {
    const registry = new ToolRegistry(createContextTools(deps));
    const ctx = { orgId: "org_1", task: { requesterRef: "user_req" }, allowedAssignees: null };

    const requester = await registry.execute("get_requester_context", { requesterRef: "user_req" }, ctx);
    assert.equal(requester.ok, true);
    assert.equal(requester.result.requester.name, "Ada");

    const kb = await registry.execute("search_knowledge", { query: "reset" }, ctx);
    assert.equal(kb.ok, true);

    const pool = await registry.execute("list_assignable_agents", {}, ctx);
    assert.equal(pool.ok, true);
    assert.deepEqual(ctx.allowedAssignees, ["user_free"]);

    const policy = await registry.execute("get_org_policy", {}, ctx);
    assert.equal(policy.ok, true);
    assert.equal(policy.result.orgName, "Acme");
  });

  test("does not require dependencies to construct", () => {
    const tools = createContextTools();
    assert.equal(tools.length, 4);
  });
});