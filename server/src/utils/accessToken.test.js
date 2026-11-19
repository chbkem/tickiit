const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const {
  TOKEN_TTL_MS,
  HASH_PREFIX_LENGTH,
  generateToken,
  hashToken,
  tokenHashPrefix,
  currentDate,
  expiresAtFor,
  isTokenWellFormed,
  isTokenUsable,
  tokenRateLimitKey,
} = require("./accessToken");
const { redactTokenInText, redactRequestContext } = require("./tokenLog");

describe("accessToken", () => {
  const NOW = Date.UTC(2026, 10, 19, 12, 0, 0);
  const deps = { now: () => NOW };

  test("generates a long url safe token and stores only its hash", () => {
    const raw = generateToken();
    assert.match(raw, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(isTokenWellFormed(raw), true);
    assert.equal(hashToken(raw), crypto.createHash("sha256").update(raw).digest("hex"));
    assert.equal(tokenHashPrefix(raw).length, HASH_PREFIX_LENGTH);
    assert.equal(raw.includes(tokenHashPrefix(raw)), false);
  });

  test("sets expiry seven days from the injected clock", () => {
    assert.equal(expiresAtFor(deps).getTime(), NOW + TOKEN_TTL_MS);
    assert.equal(currentDate(deps).getTime(), NOW);
  });

  test("a token is usable before expiry and stops at expiry or revocation", () => {
    const row = { expiresAt: new Date(NOW + 1000), revokedAt: null };
    assert.equal(isTokenUsable(row, deps), true);
    assert.equal(isTokenUsable({ ...row, expiresAt: new Date(NOW - 1) }, deps), false);
    assert.equal(isTokenUsable({ ...row, revokedAt: new Date(NOW - 10) }, deps), false);
    assert.equal(isTokenUsable(null, deps), false);
  });

  test("the rate limit key is derived from the hash prefix, not the raw token", () => {
    const raw = generateToken();
    assert.equal(tokenRateLimitKey({ params: { token: raw }, ip: "1.2.3.4" }), `customer-link:${tokenHashPrefix(raw)}`);
    assert.equal(tokenRateLimitKey({ params: {}, ip: "1.2.3.4" }), "customer-link:ip:1.2.3.4");
    assert.equal(
      tokenRateLimitKey({ params: {}, ip: "2001:db8::1234" }),
      "customer-link:ip:2001:db8::/56",
    );
  });

  test("log redaction removes a raw token from the url and params", () => {
    const raw = generateToken();
    const url = `/api/public/tickets/${raw}/replies`;
    const redactedUrl = redactTokenInText(url);
    assert.doesNotMatch(redactedUrl, new RegExp(raw));
    assert.match(redactedUrl, /\[token [0-9a-f]{12}\]/);

    const context = redactRequestContext({ url, params: { token: raw }, method: "GET" });
    assert.equal(context.method, "GET");
    assert.doesNotMatch(JSON.stringify(context), new RegExp(raw));
  });
});
