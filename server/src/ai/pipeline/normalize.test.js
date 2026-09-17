const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { normalize, NormalizeError, MAX_SUBJECT_LENGTH, SUBJECT_KEYS, BODY_KEYS } = require("./normalize");

describe("normalize", () => {
  test("extracts subject/body from the canonical keys and sanitizes markup", () => {
    const out = normalize(
      { subject: " Reset <b>broken</b> ", body: "The reset <i>email</i> never arrives." },
      { channel: "email", requesterRef: "user_1", orgId: "org_1" },
    );
    assert.equal(out.subject, "Reset broken");
    assert.equal(out.body, "The reset email never arrives.");
    assert.equal(out.channel, "email");
    assert.equal(out.requesterRef, "user_1");
    assert.equal(out.orgId, "org_1");
  });

  test("accepts alternate subject/body keys for different channels", () => {
    const out = normalize({ title: "VPN down", description: "Cannot connect" }, { channel: "slack" });
    assert.equal(out.subject, "VPN down");
    assert.equal(out.body, "Cannot connect");
    assert.ok(SUBJECT_KEYS.includes("title"));
    assert.ok(BODY_KEYS.includes("description"));
  });

  test("a raw string payload is treated as the body", () => {
    const out = normalize(" just a plain message ", { channel: "webhook" });
    assert.equal(out.body, "just a plain message");
    assert.equal(out.subject, "just a plain message");
  });

  test("derives the subject from the first body line when subject is absent", () => {
    const out = normalize({ body: "Printer jammed\nmore details below" }, { channel: "webhook" });
    assert.equal(out.subject, "Printer jammed");
    assert.equal(out.body, "Printer jammed\nmore details below");
  });

  test("falls back to an inline requester reference when none is passed", () => {
    const out = normalize({ subject: "S", body: "B", from: "user_42" }, { channel: "email" });
    assert.equal(out.requesterRef, "user_42");
    const explicit = normalize({ subject: "S", body: "B", from: "user_42" }, { channel: "email", requesterRef: "user_9" });
    assert.equal(explicit.requesterRef, "user_9");
  });

  test("caps subject and body lengths", () => {
    const out = normalize({ subject: "x".repeat(MAX_SUBJECT_LENGTH + 200), body: "y".repeat(9000) }, { channel: "email" });
    assert.ok(out.subject.length <= MAX_SUBJECT_LENGTH);
    assert.match(out.subject, /…$/);
    assert.ok(out.body.length <= 8000);
    assert.match(out.body, /…$/);
  });

  test("normalizes CRLF, trims whitespace, and treats empty fields as null", () => {
    const out = normalize({ subject: "  ", body: "line1\r\nline2" }, { channel: "email", orgId: "   " });
    assert.equal(out.subject, "line1");
    assert.equal(out.body, "line1\nline2");
    assert.equal(out.orgId, null);
  });

  test("defaults channel to UNKNOWN", () => {
    const out = normalize({ subject: "S", body: "B" }, {});
    assert.equal(out.channel, "UNKNOWN");
  });

  test("throws NormalizeError when nothing derivable", () => {
    assert.throws(() => normalize({}, { channel: "email" }), (err) => err instanceof NormalizeError);
    assert.throws(() => normalize(null, { channel: "email" }), (err) => err.name === "NormalizeError");
    assert.throws(() => normalize([1, 2], { channel: "email" }), (err) => err.name === "NormalizeError");
  });
});