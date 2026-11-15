const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { sha256Hex, normalizeEmail, hashIp, hashEmail, hashBody, emailDomain } = require("./hash");

const SALT = "salt-a";

describe("hash", () => {
  test("sha256Hex is deterministic hex", () => {
    assert.equal(sha256Hex("abc"), sha256Hex("abc"));
    assert.match(sha256Hex("abc"), /^[0-9a-f]{64}$/);
  });

  test("normalizeEmail trims and lowercases", () => {
    assert.equal(normalizeEmail("  Ada@Example.COM "), "ada@example.com");
    assert.equal(normalizeEmail(undefined), "");
  });

  test("hashIp and hashEmail are salted and never contain the raw value", () => {
    const ip = "203.0.113.7";
    const email = "ada@example.com";

    assert.match(hashIp(ip, SALT), /^[0-9a-f]{64}$/);
    assert.ok(!hashIp(ip, SALT).includes(ip));
    assert.ok(!hashEmail(email, SALT).includes("ada"));

    assert.notEqual(hashIp(ip, SALT), hashIp(ip, "salt-b"));
    assert.notEqual(hashEmail(email, SALT), hashEmail("other@example.com", SALT));
  });

  test("hashEmail is stable across email casing and whitespace", () => {
    assert.equal(hashEmail("ada@example.com", SALT), hashEmail("  ADA@Example.com ", SALT));
  });

  test("hashBody normalizes first and hides the raw text", () => {
    assert.equal(hashBody("Hello, World!", SALT), hashBody("hello   world", SALT));
    assert.match(hashBody("Hello, World!", SALT), /^[0-9a-f]{64}$/);
    assert.ok(!hashBody("my secret password", SALT).includes("secret"));
    assert.notEqual(hashBody("hello", SALT), hashBody("hello", "salt-b"));
  });

  test("emailDomain returns the part after the last @", () => {
    assert.equal(emailDomain("  Ada@Sub.Example.COM "), "sub.example.com");
    assert.equal(emailDomain("not-an-email"), null);
    assert.equal(emailDomain("trailing@"), null);
  });
});
