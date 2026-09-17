const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry } = require("./registry");
const { requesterContextTool, RequesterContextInput, MAX_RECENT_TICKETS } = require("./requesterContext");

const runTool = async (tool, args, ctx = {}) => {
  const registry = new ToolRegistry([tool]);
  return registry.execute(tool.name, args, ctx);
};

const store = (overrides = {}) => {
  const calls = [];
  const fake = {
    getRequesterContext: async (args) => {
      calls.push(args);
      return {
        requester: { ref: "user_1", name: "Ada", email: "ada@example.com", role: "admin" },
        openTicketCount: 2,
        totalTicketCount: 5,
        recentTickets: [
          { id: "t-1", subject: "Login <b>fails</b>", status: "OPEN", priority: "HIGH", type: "BUG", createdAt: "2026-01-05" },
          { id: "t-2", subject: "Slow upload", status: "RESOLVED", priority: "MEDIUM", type: "TASK", createdAt: "2026-01-01" },
        ],
        ...overrides,
      };
    },
  };
  return { fake, calls };
};

describe("requesterContext tool", () => {
  test("resolves the requester profile, counts, and recent tickets", async () => {
    const { fake, calls } = store();
    const out = await runTool(requesterContextTool({ requesterStore: fake }), { requesterRef: "user_1" }, { orgId: "org_1" });
    assert.equal(out.ok, true);
    assert.equal(out.kind, "read");
    assert.equal(out.result.requester.name, "Ada");
    assert.equal(out.result.openTicketCount, 2);
    assert.equal(out.result.totalTicketCount, 5);
    assert.equal(out.result.recentTickets.length, 2);
    assert.equal(out.result.recentTickets[0].subject, "Login fails");
    assert.deepEqual(calls[0], { orgId: "org_1", requesterRef: "user_1" });
  });

  test("reads org/requester from ctx.task when ctx.orgId is absent", async () => {
    const { fake, calls } = store();
    const out = await runTool(
      requesterContextTool({ requesterStore: fake }),
      { requesterRef: "user_1" },
      { task: { orgId: "org_9", requesterRef: "user_1" } },
    );
    assert.equal(out.ok, true);
    assert.deepEqual(calls[0], { orgId: "org_9", requesterRef: "user_1" });
  });

  test("caps recent tickets to MAX_RECENT_TICKETS", async () => {
    const { fake } = store({
      recentTickets: Array.from({ length: 20 }, (_, i) => ({ id: `t-${i}`, subject: `Ticket ${i}`, status: "OPEN", priority: "LOW", type: "TASK" })),
    });
    const out = await runTool(requesterContextTool({ requesterStore: fake }), { requesterRef: "user_1" }, {});
    assert.equal(out.ok, true);
    assert.equal(out.result.recentTickets.length, MAX_RECENT_TICKETS);
  });

  test("unknown requester degrades to a harmless no-context result", async () => {
    const { fake } = store();
    fake.getRequesterContext = async () => null;
    const out = await runTool(requesterContextTool({ requesterStore: fake }), { requesterRef: "user_9" }, {});
    assert.equal(out.ok, true);
    assert.equal(out.result.requester, null);
    assert.match(out.result.note, /not found/);
  });

  test("missing store reports unavailability instead of throwing", async () => {
    const out = await runTool(requesterContextTool({}), { requesterRef: "user_1" }, {});
    assert.equal(out.ok, true);
    assert.match(out.result.note, /unavailable/);
  });

  test("input schema is strict and rejects empty/extra fields", () => {
    assert.equal(RequesterContextInput.safeParse({ requesterRef: "user_1" }).success, true);
    assert.equal(RequesterContextInput.safeParse({ requesterRef: "  " }).success, false);
    assert.equal(RequesterContextInput.safeParse({ requesterRef: "user_1", extra: true }).success, false);
  });
});