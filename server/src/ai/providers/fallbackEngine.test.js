const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { FallbackDeterministicProvider, matchType, matchPriority, assessConfidence, buildSubject } = require("./fallbackEngine");

describe("FallbackDeterministicProvider", () => {
  test("classifies an outage as INCIDENT/URGENT", () => {
    const p = new FallbackDeterministicProvider();
    const { decision, confidence } = p.decide({
      subject: "Production site is down",
      body: "Our checkout page is throwing 500s and customers cannot place orders.",
    });
    assert.equal(decision.type, "INCIDENT");
    assert.equal(decision.priority, "URGENT");
    assert.equal(decision.assigneeRef, null);
    assert.equal(decision.subject, "Production site is down");
    assert.ok(decision.rationale.length > 0);
    assert.equal(typeof confidence.score, "number");
  });

  test("classifies a broken login as BUG/HIGH", () => {
    const p = new FallbackDeterministicProvider();
    const { decision } = p.decide({ subject: "Login form is broken - 500 error" });
    assert.equal(decision.type, "BUG");
    assert.equal(decision.priority, "HIGH");
  });

  test("classifies a feature request as REQUEST/MEDIUM", () => {
    const p = new FallbackDeterministicProvider();
    const { decision } = p.decide({ subject: "Could you add a new export button to the dashboard" });
    assert.equal(decision.type, "REQUEST");
    assert.equal(decision.priority, "MEDIUM");
  });

  test("defaults an ambiguous message to TASK/MEDIUM", () => {
    const p = new FallbackDeterministicProvider();
    const { decision } = p.decide({ subject: "Meeting notes for tomorrow" });
    assert.equal(decision.type, "TASK");
    assert.equal(decision.priority, "MEDIUM");
  });

  test("assigneeRef is always null (agent never auto-assigns)", () => {
    const p = new FallbackDeterministicProvider();
    const { decision } = p.decide({ subject: "Please fix the bug", body: "" });
    assert.equal(decision.assigneeRef, null);
  });

  test("falls back on empty input", () => {
    const p = new FallbackDeterministicProvider();
    const { decision } = p.decide({});
    assert.equal(decision.subject, "Untriaged input");
    assert.equal(decision.type, "TASK");
  });

  test("confidence score is capped below the 0.7 auto-apply threshold", () => {
    const p = new FallbackDeterministicProvider();
    const extreme = p.decide({ subject: "URGENT critical security breach outage", body: "Production is down urgently" });
    assert.ok(extreme.confidence.score <= 0.65);
    assert.ok(extreme.confidence.score >= 0);
    assert.ok(extreme.confidence.reasoning.length > 0);
    assert.ok(Array.isArray(extreme.confidence.signals));
  });

  test("matchPriority: urgent signal wins over low", () => {
    assert.equal(matchPriority("minor issue but urgent"), "URGENT");
  });

  test("assessConfidence rises with signals but stays bounded", () => {
    const low = assessConfidence("hello world", "TASK", "MEDIUM");
    assert.deepEqual(low.signals, []);
    const high = assessConfidence("the production outage is critical and urgent right now please fix", "INCIDENT", "URGENT");
    assert.ok(high.score > low.score);
    assert.ok(high.score <= 0.65);
  });

  test("buildSubject truncates long subjects and uses body first line", () => {
    assert.equal(buildSubject("", "Body first line\nsecond line"), "Body first line");
    const long = buildSubject("x".repeat(300), "");
    assert.ok(long.length <= 200);
    assert.ok(long.endsWith("…"));
  });

  test("chat() is a drop-in provider producing a JSON decision", async () => {
    const p = new FallbackDeterministicProvider();
    const out = await p.chat({ messages: [{ role: "user", content: "Our API is down - emergency" }] });
    assert.equal(p.providerId, "fallback-deterministic");
    assert.equal(out.choices.length, 1);
    assert.equal(out.choices[0].finishReason, "stop");
    assert.deepEqual(out.usage, { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    const parsed = JSON.parse(out.choices[0].message.content);
    assert.equal(parsed.decision.type, "INCIDENT");
    assert.equal(typeof parsed.confidence.score, "number");
  });
});