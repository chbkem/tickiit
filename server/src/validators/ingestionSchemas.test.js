const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createIngestionSchema, MAX_CHANNEL_LENGTH } = require("./ingestionSchemas");

describe("createIngestionSchema", () => {
  test("accepts a full valid payload and sanitizes fields", () => {
    const result = createIngestionSchema.safeParse({
      body: {
        channel: " email ",
        externalId: " <b>ext-42</b> ",
        raw: { subject: "Printer <i>jam</i>", body: "hello" },
        requesterRef: "user_1",
        orgId: "org_1",
      },
    });
    assert.ok(result.success);
    assert.equal(result.data.body.channel, "email");
    assert.equal(result.data.body.externalId, "ext-42");
    assert.deepEqual(result.data.body.raw, { subject: "Printer jam", body: "hello" });
  });

  test("accepts raw as a plain string", () => {
    const result = createIngestionSchema.safeParse({ body: { channel: "webhook", externalId: "x1", raw: "just text" } });
    assert.ok(result.success);
    assert.equal(result.data.body.raw, "just text");
  });

  test("rejects missing channel/externalId/raw", () => {
    for (const body of [
      { externalId: "x", raw: "text" },
      { channel: "email", raw: "text" },
      { channel: "email", externalId: "x" },
      {},
    ]) {
      const result = createIngestionSchema.safeParse({ body });
      assert.ok(!result.success);
    }
  });

  test("rejects empty channel/externalId", () => {
    for (const body of [
      { channel: "   ", externalId: "x", raw: "text" },
      { channel: "email", externalId: "", raw: "text" },
    ]) {
      const result = createIngestionSchema.safeParse({ body });
      assert.ok(!result.success);
    }
  });

  test("rejects unknown keys", () => {
    const result = createIngestionSchema.safeParse({
      body: { channel: "email", externalId: "x", raw: "text", injected: true },
    });
    assert.ok(!result.success);
  });

  test("caps channel length", () => {
    const result = createIngestionSchema.safeParse({
      body: { channel: "x".repeat(MAX_CHANNEL_LENGTH + 5), externalId: "x", raw: "text" },
    });
    assert.ok(!result.success);
  });
});