const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { TriageDecision, Confidence, TriageResponse, parseTriageResponse } = require("./triageDecision");

describe("TriageDecision contract", () => {
  test("parses a valid decision and normalizes casing", () => {
    const res = TriageDecision.safeParse({
      subject: " Cannot reset password ",
      type: "bug",
      priority: "high",
      assigneeRef: "user_123",
      rationale: "User is locked out of their account.",
    });
    assert.equal(res.success, true);
    assert.equal(res.data.subject, "Cannot reset password");
    assert.equal(res.data.type, "BUG");
    assert.equal(res.data.priority, "HIGH");
    assert.equal(res.data.assigneeRef, "user_123");
  });

  test("defaults absent assigneeRef to null", () => {
    const res = TriageDecision.safeParse({
      subject: "New printer",
      type: "REQUEST",
      priority: "MEDIUM",
      rationale: "User wants a new printer.",
    });
    assert.equal(res.success, true);
    assert.equal(res.data.assigneeRef, null);
  });

  test("coerces empty assigneeRef to null", () => {
    const res = TriageDecision.safeParse({
      subject: "New printer",
      type: "REQUEST",
      priority: "MEDIUM",
      assigneeRef: "   ",
      rationale: "User wants a new printer.",
    });
    assert.equal(res.success, true);
    assert.equal(res.data.assigneeRef, null);
  });

  test("strips HTML from untrusted text fields", () => {
    const res = TriageDecision.safeParse({
      subject: "<script>alert(1)</script> Reset password",
      type: "BUG",
      priority: "HIGH",
      rationale: "<b>Locked</b> out",
    });
    assert.equal(res.success, true);
    assert.ok(!res.data.subject.includes("<"));
    assert.ok(!res.data.rationale.includes("<"));
    assert.equal(res.data.subject, "Reset password");
    assert.equal(res.data.rationale, "Locked out");
  });

  test("rejects invalid enum values", () => {
    const res = TriageDecision.safeParse({
      subject: "x",
      type: "NOT_A_TYPE",
      priority: "MEDIUM",
      rationale: "y",
    });
    assert.equal(res.success, false);
  });

  test("rejects missing subject and missing rationale", () => {
    assert.equal(
      TriageDecision.safeParse({ type: "TASK", priority: "MEDIUM", rationale: "why" }).success,
      false,
    );
    assert.equal(
      TriageDecision.safeParse({ subject: "x", type: "TASK", priority: "MEDIUM" }).success,
      false,
    );
  });

  test("rejects out-of-range confidence score", () => {
    assert.equal(Confidence.safeParse({ score: 0.7 }).success, true);
    assert.equal(Confidence.safeParse({ score: 1.1 }).success, false);
    assert.equal(Confidence.safeParse({ score: -0.1 }).success, false);
    assert.equal(Confidence.safeParse({}).success, false);
  });

  test("rejects strict-mismatched keys on decision and confidence", () => {
    assert.equal(
      TriageDecision.safeParse({
        subject: "x",
        type: "TASK",
        priority: "MEDIUM",
        rationale: "y",
        extraKey: true,
      }).success,
      false,
    );
    assert.equal(Confidence.safeParse({ score: 0.5, extraKey: true }).success, false);
  });

  test("parseTriageResponse validates a full model output", () => {
    const ok = parseTriageResponse({
      decision: {
        subject: "Outage in production",
        type: "incident",
        priority: "urgent",
        assigneeRef: null,
        rationale: "Production is down.",
      },
      confidence: {
        score: 0.82,
        label: "HIGH",
        reasoning: "Strong outage signals",
        signals: ["outage", "production word match"],
      },
    });
    assert.equal(ok.success, true);
    assert.equal(ok.data.decision.type, "INCIDENT");
    assert.equal(ok.data.confidence.label, "HIGH");

    const nok = parseTriageResponse({ decision: { subject: "x" } });
    assert.equal(nok.success, false);
  });
});