const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { signFormToken, verifyFormToken } = require("./formToken");

const SECRET = "test-secret-value";
const NOW = 1_700_000_000_000;

describe("formToken", () => {
  test("round trips a signed payload", () => {
    const token = signFormToken({ publicId: "form-1", issuedAt: NOW }, SECRET);
    const result = verifyFormToken(token, SECRET, { now: NOW });

    assert.equal(result.ok, true);
    assert.deepEqual(result.payload, { publicId: "form-1", issuedAt: NOW });
  });

  test("reports a missing token without throwing", () => {
    assert.deepEqual(verifyFormToken(undefined, SECRET, { now: NOW }), {
      ok: false,
      reason: "missing",
    });
    assert.deepEqual(verifyFormToken("", SECRET, { now: NOW }), {
      ok: false,
      reason: "missing",
    });
  });

  test("rejects a malformed token", () => {
    assert.equal(verifyFormToken("not-a-token", SECRET, { now: NOW }).ok, false);
    assert.equal(verifyFormToken("a.b.c", SECRET, { now: NOW }).ok, false);
  });

  test("rejects a tampered signature", () => {
    const token = signFormToken({ publicId: "form-1", issuedAt: NOW }, SECRET);
    assert.equal(verifyFormToken(`${token}x`, SECRET, { now: NOW }).ok, false);
  });

  test("rejects a token signed with a different secret", () => {
    const token = signFormToken({ publicId: "form-1", issuedAt: NOW }, "other-secret");
    assert.equal(verifyFormToken(token, SECRET, { now: NOW }).ok, false);
  });

  test("rejects a tampered payload", () => {
    const token = signFormToken({ publicId: "form-1", issuedAt: NOW }, SECRET);
    const [, signature] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ publicId: "form-2", issuedAt: NOW }),
    ).toString("base64url");
    assert.equal(verifyFormToken(`${forgedBody}.${signature}`, SECRET, { now: NOW }).ok, false);
  });

  test("expires a well formed but stale token", () => {
    const token = signFormToken({ publicId: "form-1", issuedAt: NOW }, SECRET);
    const result = verifyFormToken(token, SECRET, { now: NOW + 1000, ttlMs: 500 });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "expired");
    assert.equal(result.payload.publicId, "form-1");
  });

  test("rejects a payload with the wrong shape", () => {
    const token = signFormToken({ publicId: 42, issuedAt: "soon" }, SECRET);
    assert.equal(verifyFormToken(token, SECRET, { now: NOW }).ok, false);
  });
});
