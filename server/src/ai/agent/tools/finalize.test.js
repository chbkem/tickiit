const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry } = require("./registry");
const { finalizeTool, FinalizeInput } = require("./finalize");

const runTool = async (tool, args, ctx = {}) => {
  const registry = new ToolRegistry([tool]);
  return registry.execute(tool.name, args, ctx);
};

const draft = {
  draftId: "d-1",
  subject: "Reset password is broken",
  description: "Reset email never arrives",
  type: "BUG",
  priority: "HIGH",
  assigneeRef: null,
};

const decision = {
  subject: "Reset password is broken",
  type: "BUG",
  priority: "HIGH",
  assigneeRef: null,
  rationale: "The reset flow errors out for most users.",
};

const confidence = { score: 0.85, label: "HIGH", reasoning: "Clear repro" };

describe("finalize tool", () => {
  test("accepts a decision matching its draft and echoes the confirmed payload", async () => {
    const out = await runTool(
      finalizeTool(),
      { draftId: "d-1", decision, confidence },
      { getDraft: (id) => (id === "d-1" ? draft : null) },
    );
    assert.equal(out.ok, true);
    assert.equal(out.kind, "finalize");
    assert.equal(out.result.accepted, true);
    assert.equal(out.result.draftId, "d-1");
    assert.deepEqual(out.result.decision, decision);
    assert.deepEqual(out.result.confidence, confidence);
    assert.equal(out.result.draft.draftId, "d-1");
    assert.equal(out.result.draft.description, draft.description);
  });

  test("rejects a finalize with an unknown draftId", async () => {
    const out = await runTool(finalizeTool(), { draftId: "missing", decision, confidence }, { getDraft: () => null });
    assert.equal(out.ok, false);
    assert.match(out.error, /No draft found/);
  });

  test("rejects when the decision diverges from the stored draft", async () => {
    const ctx = { getDraft: (id) => (id === "d-1" ? draft : null) };
    const subjectOut = await runTool(
      finalizeTool(),
      { draftId: "d-1", decision: { ...decision, subject: "Something else" }, confidence },
      ctx,
    );
    assert.equal(subjectOut.ok, false);
    assert.match(subjectOut.error, /subject/);

    const assnOut = await runTool(
      finalizeTool(),
      { draftId: "d-1", decision: { ...decision, assigneeRef: "user_9" }, confidence },
      ctx,
    );
    assert.equal(assnOut.ok, false);
    assert.match(assnOut.error, /assigneeRef/);
  });

  test("FinalizeInput enforces the confidence and decision contracts", () => {
    const ok = FinalizeInput.safeParse({ draftId: "d-1", decision, confidence });
    assert.equal(ok.success, true);

    assert.equal(
      FinalizeInput.safeParse({ draftId: "d-1", decision, confidence: { score: 1.5 } }).success,
      false,
    );
    assert.equal(
      FinalizeInput.safeParse({ draftId: "d-1", decision: { ...decision, type: "NOPE" }, confidence }).success,
      false,
    );
    assert.equal(FinalizeInput.safeParse({ draftId: "d-1", decision, confidence, extra: true }).success, false);
  });

  test("exposes a terminal descriptor", () => {
    const tool = finalizeTool();
    assert.equal(tool.name, "finalize");
    assert.equal(tool.kind, "finalize");
    assert.equal(typeof tool.description, "string");
  });
});