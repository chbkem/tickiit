const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry } = require("./registry");
const { createTicketTool, TicketDraft } = require("./createTicket");

const runTool = async (tool, args, ctx = {}) => {
  const registry = new ToolRegistry([tool]);
  return registry.execute(tool.name, args, ctx);
};

describe("create_ticket tool", () => {
  test("drafts with normalized casing and trimmed text, stored in ctx", async () => {
    const drafts = new Map();
    const out = await runTool(
      createTicketTool(),
      {
        subject: " Cannot reset password ",
        description: "The reset email never arrives",
        type: "bug",
        priority: "high",
      },
      { storeDraft: (id, d) => drafts.set(id, d) },
    );
    assert.equal(out.ok, true);
    assert.equal(out.result.subject, "Cannot reset password");
    assert.equal(out.result.description, "The reset email never arrives");
    assert.equal(out.result.type, "BUG");
    assert.equal(out.result.priority, "HIGH");
    assert.equal(out.result.assigneeRef, null);
    assert.equal(typeof out.result.draftId, "string");
    assert.equal(drafts.has(out.result.draftId), true);
  });

  test("defaults absent description and assigneeRef to null", async () => {
    const out = await runTool(createTicketTool(), {
      subject: "Fix login",
      type: "TASK",
      priority: "low",
    });
    assert.equal(out.ok, true);
    assert.equal(out.result.description, null);
    assert.equal(out.result.assigneeRef, null);
  });

  test("sanitizes untrusted text (description/subject) of HTML", async () => {
    const out = await runTool(createTicketTool(), {
      subject: "<script>alert(1)</script> Reset password",
      description: "<b>hi</b> &amp; bye",
      type: "BUG",
      priority: "HIGH",
    });
    assert.equal(out.ok, true);
    assert.ok(!out.result.subject.includes("<"));
    assert.ok(!/script/i.test(out.result.subject));
    assert.ok(!out.result.description.includes("<"));
    assert.ok(!/<\/?b>/i.test(out.result.description));
    assert.match(out.result.description, /hi/);
    assert.match(out.result.description, /bye/);
  });

  test("rejects assignees outside the allowed pool", async () => {
    const calls = [];
    const out = await runTool(
      createTicketTool(),
      { subject: "x", type: "BUG", priority: "HIGH", assigneeRef: "user_9" },
      { allowedAssignees: ["user_1", "user_2"], storeDraft: (...a) => calls.push(a) },
    );
    assert.equal(out.ok, false);
    assert.match(out.error, /not in the allowed assignee pool/);
    assert.equal(calls.length, 0);
  });

  test("accepts an assignee from the pool and a null assignee with a pool", async () => {
    const ctx = { allowedAssignees: ["user_1"], storeDraft: () => {} };
    const ok = await runTool(createTicketTool(), { subject: "x", type: "BUG", priority: "HIGH", assigneeRef: "user_1" }, ctx);
    assert.equal(ok.ok, true);
    assert.equal(ok.result.assigneeRef, "user_1");

    const none = await runTool(createTicketTool(), { subject: "x", type: "BUG", priority: "HIGH" }, ctx);
    assert.equal(none.ok, true);
    assert.equal(none.result.assigneeRef, null);
  });

  test("rejects any assigneeRef when the pool is present but empty", async () => {
    const out = await runTool(
      createTicketTool(),
      { subject: "x", type: "BUG", priority: "HIGH", assigneeRef: "user_1" },
      { allowedAssignees: [], storeDraft: () => {} },
    );
    assert.equal(out.ok, false);
    assert.match(out.error, /allowed assignee pool/);
  });

  test("TicketDraft is closed-world: rejects status/delete/arbitrary keys", () => {
    const base = { subject: "x", type: "BUG", priority: "HIGH" };
    assert.equal(TicketDraft.safeParse({ ...base, status: "CLOSED" }).success, false);
    assert.equal(TicketDraft.safeParse({ ...base, delete: true }).success, false);
    assert.equal(TicketDraft.safeParse({ ...base, random: 1 }).success, false);
  });

  test("rejects invalid enum values and blank subject", () => {
    assert.equal(TicketDraft.safeParse({ subject: "x", type: "NOPE", priority: "HIGH" }).success, false);
    assert.equal(TicketDraft.safeParse({ subject: "   ", type: "BUG", priority: "HIGH" }).success, false);
  });

  test("exposes a draft-only descriptor", () => {
    const tool = createTicketTool();
    assert.equal(tool.name, "create_ticket");
    assert.equal(tool.kind, "draft");
    assert.equal(typeof tool.description, "string");
    assert.match(tool.description, /draft/i);
  });
});