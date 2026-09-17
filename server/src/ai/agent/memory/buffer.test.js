const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { MessageBuffer, estimateTokens, TRUNCATION_MARKER } = require("./buffer");

describe("MessageBuffer", () => {
  test("estimates tokens as ~4 chars per token", () => {
    assert.equal(estimateTokens("abcd"), 1);
    assert.equal(estimateTokens("abcdefgh"), 2);
    assert.equal(estimateTokens(""), 0);
  });

  test("keeps messages intact while under budget", () => {
    const b = new MessageBuffer({ maxTokens: 1000 });
    b.push({ role: "system", content: "sys" });
    b.push({ role: "user", content: "hello" });
    b.push({ role: "tool", tool_call_id: "1", content: '{"ok":true}' });
    assert.equal(b.length, 3);
    assert.equal(b.messages[2].content, '{"ok":true}');
  });

  test("truncates consumed tool results oldest-first when over budget", () => {
    const b = new MessageBuffer({ maxTokens: 50 });
    b.push({ role: "system", content: "s".repeat(40) }); // ~10 tokens
    b.push({ role: "user", content: "u".repeat(40) }); //  ~10 tokens
    b.push({ role: "tool", tool_call_id: "a", content: "a".repeat(200) }); // ~50 → over
    assert.ok(b.estimatedTokens <= 50);
    assert.equal(b.messages.length, 3);
    assert.equal(b.messages[0].role, "system");
    assert.equal(b.messages[1].role, "user");
    assert.equal(b.messages[2].content, TRUNCATION_MARKER);
    assert.equal(b.messages[2].tool_call_id, "a");

    b.push({ role: "tool", tool_call_id: "b", content: "b".repeat(200) });
    assert.ok(b.estimatedTokens <= 50);
    assert.equal(b.messages[3].content, TRUNCATION_MARKER);
    assert.equal(b.messages[3].tool_call_id, "b");
  });

  test("conservatively stops evicting when only system + first user remain", () => {
    const b = new MessageBuffer({ maxTokens: 10 });
    b.push({ role: "system", content: "s".repeat(80) }); // ~20 tokens, already over
    b.push({ role: "user", content: "u".repeat(80) }); //  ~20 tokens
    b.push({ role: "tool", tool_call_id: "a", content: "a".repeat(200) });
    assert.equal(b.messages.length, 3);
    assert.equal(b.messages[0].content, "s".repeat(80));
    assert.equal(b.messages[1].content, "u".repeat(80));
    assert.equal(b.messages[2].content, TRUNCATION_MARKER);
  });

  test("replaceLast swaps the final message", () => {
    const b = new MessageBuffer({ maxTokens: 100 });
    b.push({ role: "user", content: "first" });
    b.replaceLast({ role: "user", content: "second" });
    assert.equal(b.length, 1);
    assert.equal(b.messages[0].content, "second");
  });
});