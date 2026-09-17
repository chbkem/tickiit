const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry } = require("./registry");
const { agentPoolTool, AgentPoolInput, MAX_AGENTS_SHOWN } = require("./agentPool");

const runTool = async (tool, args, ctx = {}) => {
  const registry = new ToolRegistry([tool]);
  return registry.execute(tool.name, args, ctx);
};

const pool = (overrides = []) => {
  const calls = [];
  const fake = {
    listAssignableAgents: async (args) => {
      calls.push(args);
      return overrides;
    },
  };
  return { fake, calls };
};

const RAW_AGENTS = [
  { ref: "user_busy", name: "B", role: "agent", openTicketCount: 9 },
  { ref: "user_free", name: "A", role: "admin", openTicketCount: 1 },
  { ref: "user_mid", name: "C", role: "agent", openTicketCount: 4 },
];

describe("agentPool tool", () => {
  test("returns agents sorted by workload and updates ctx.allowedAssignees", async () => {
    const { fake, calls } = pool(RAW_AGENTS);
    const ctx = { orgId: "org_1", task: { requesterRef: "user_req" }, allowedAssignees: ["stale"] };
    const out = await runTool(agentPoolTool({ agentPoolService: fake }), {}, ctx);
    assert.equal(out.ok, true);
    assert.equal(out.kind, "read");
    assert.deepEqual(
      out.result.agents.map((a) => a.ref),
      ["user_free", "user_mid", "user_busy"],
    );
    assert.deepEqual(out.result.assignableRefs, ["user_free", "user_mid", "user_busy"]);
    assert.deepEqual(ctx.allowedAssignees, ["user_free", "user_mid", "user_busy"]);
    assert.deepEqual(calls[0], { orgId: "org_1", requesterRef: "user_req" });
  });

  test("reads org and requester from ctx.task when ctx.orgId is absent", async () => {
    const { fake, calls } = pool(RAW_AGENTS);
    const out = await runTool(
      agentPoolTool({ agentPoolService: fake }),
      {},
      { task: { orgId: "org_7", requesterRef: "user_r" } },
    );
    assert.equal(out.ok, true);
    assert.deepEqual(calls[0], { orgId: "org_7", requesterRef: "user_r" });
  });

  test("clears allowedAssignees when the pool is empty (service wired)", async () => {
    const { fake } = pool([]);
    const ctx = { orgId: "org_1", allowedAssignees: ["stale"] };
    const out = await runTool(agentPoolTool({ agentPoolService: fake }), {}, ctx);
    assert.equal(out.ok, true);
    assert.deepEqual(out.result.agents, []);
    assert.deepEqual(ctx.allowedAssignees, []);
  });

  test("missing service leaves the existing pool untouched", async () => {
    const ctx = { orgId: "org_1", allowedAssignees: ["stale"] };
    const out = await runTool(agentPoolTool({}), {}, ctx);
    assert.equal(out.ok, true);
    assert.match(out.result.note, /unavailable/);
    assert.deepEqual(ctx.allowedAssignees, ["stale"]);
  });

  test("caps the pool at MAX_AGENTS_SHOWN", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ref: `u${i}`, name: `U${i}`, role: "agent", openTicketCount: i }));
    const { fake } = pool(many);
    const ctx = {};
    const out = await runTool(agentPoolTool({ agentPoolService: fake }), {}, ctx);
    assert.equal(out.ok, true);
    assert.equal(out.result.agents.length, MAX_AGENTS_SHOWN);
  });

  test("input schema is strict and empty", () => {
    assert.equal(AgentPoolInput.safeParse({}).success, true);
    assert.equal(AgentPoolInput.safeParse({ ref: "user_1" }).success, false);
  });
});