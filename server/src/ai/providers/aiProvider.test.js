const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { AiProvider, ProviderError } = require("./aiProvider");

describe("AiProvider interface", () => {
  test("base class chat() throws not-implemented", async () => {
    const p = new AiProvider();
    await assert.rejects(() => p.chat({ messages: [] }));
  });

  test("base class providerId getter throws", () => {
    const p = new AiProvider();
    assert.throws(() => p.providerId);
  });

  test("ProviderError carries code and status", () => {
    const err = new ProviderError("boom", "HTTP_ERROR", 429);
    assert.equal(err.name, "ProviderError");
    assert.equal(err.code, "HTTP_ERROR");
    assert.equal(err.status, 429);
    assert.ok(err.message.includes("boom"));
  });
});