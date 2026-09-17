const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { Decider } = require("./decider");

const validResponse = {
  decision: {
    subject: "Production outage",
    type: "incident",
    priority: "urgent",
    assigneeRef: null,
    rationale: "Checkout is down.",
  },
  confidence: { score: 0.82, label: "HIGH", signals: ["outage"] },
};

describe("Decider", () => {
  test("validate accepts a well-formed TriageResponse and normalizes casing", () => {
    const d = new Decider();
    const res = d.validate(validResponse);
    assert.equal(res.success, true);
    assert.equal(res.data.decision.type, "INCIDENT");
    assert.equal(res.data.decision.priority, "URGENT");
  });

  test("validate rejects malformed output", () => {
    const d = new Decider();
    assert.equal(d.validate({ decision: { subject: "x" } }).success, false);
    assert.equal(d.validate("not json").success, false);
  });

  test("validationHint surfaces the failing path for the repair turn", () => {
    const d = new Decider();
    const res = d.validate(validResponse);
    assert.equal(res.success, true);
    const bad = d.validate({ decision: { subject: "x", type: "NOPE", priority: "HIGH", rationale: "y" }, confidence: { score: 1.1 } });
    const hint = d.validationHint(bad.error);
    assert.match(hint, /failed validation/);
    assert.match(hint, /type/);
    assert.match(hint, /decision/);
  });

  test("fallback returns a deterministic decision with bounded confidence", () => {
    const d = new Decider();
    const { decision, confidence } = d.fallback({ subject: "URGENT production outage", body: "everything is down" });
    assert.equal(decision.type, "INCIDENT");
    assert.ok(confidence.score <= 0.65);
    assert.equal(decision.assigneeRef, null);
  });

  test("fallback tolerates missing input", () => {
    const d = new Decider();
    const { decision } = d.fallback({});
    assert.equal(typeof decision.subject, "string");
    assert.ok(decision.subject.length > 0);
  });

  test("uses an injected fallbackProvider when provided", async () => {
    const calls = [];
    const fakeFallback = {
      providerId: "fake-fallback",
      decide: (input) => {
        calls.push(input);
        return { decision: { subject: "x", type: "TASK", priority: "LOW", assigneeRef: null, rationale: "r" }, confidence: { score: 0.5 } };
      },
    };
    const d = new Decider({ fallbackProvider: fakeFallback });
    const res = d.fallback({ subject: "s", body: "b" });
    assert.equal(d.fallbackProvider.providerId, "fake-fallback");
    assert.equal(res.decision.subject, "x");
    assert.equal(calls[0].subject, "s");
  });
});