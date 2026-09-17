const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  mapUsage,
  summarizeToolCalls,
  normalizeGenerateResult,
  normalizeToolLoopResult,
} = require("./runAgent");

describe("runAgent helpers", () => {
  test("mapUsage normalizes missing fields to zero", () => {
    assert.deepEqual(mapUsage({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }), {
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
    });
    assert.deepEqual(mapUsage(undefined), { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  test("summarizeToolCalls flattens step tool calls", () => {
    const steps = [
      { toolCalls: [{ toolName: "list_tickets", args: { limit: 5 } }] },
      { toolCalls: [] },
    ];
    assert.deepEqual(summarizeToolCalls(steps), [
      { name: "list_tickets", args: { limit: 5 } },
    ]);
    assert.deepEqual(summarizeToolCalls(undefined), []);
  });

  test("normalizeGenerateResult maps output, text, usage, and step count", () => {
    const result = normalizeGenerateResult({
      output: { subject: "S", type: "TASK" },
      text: "raw",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      steps: [{ toolCalls: [] }],
    });
    assert.deepEqual(result.output, { subject: "S", type: "TASK" });
    assert.equal(result.rawText, "raw");
    assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    assert.equal(result.stepCount, 1);
  });

  test("normalizeGenerateResult tolerates an empty result", () => {
    assert.deepEqual(normalizeGenerateResult(), {
      output: undefined,
      rawText: "",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      stepCount: 0,
    });
  });

  test("normalizeToolLoopResult maps text and summarized tool calls", () => {
    const result = normalizeToolLoopResult({
      text: "",
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
      steps: [{ toolCalls: [{ toolName: "create_ticket", args: { type: "BUG" } }] }],
    });
    assert.deepEqual(result.toolCalls, [{ name: "create_ticket", args: { type: "BUG" } }]);
    assert.deepEqual(result.usage, { inputTokens: 3, outputTokens: 2, totalTokens: 5 });
    assert.equal(result.stepCount, 1);
  });
});