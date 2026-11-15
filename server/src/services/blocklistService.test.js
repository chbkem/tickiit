const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { domainMatches, domainIsDisposable } = require("./blocklistService");

describe("blocklistService", () => {
  test("domainMatches matches the domain and its subdomains only", () => {
    assert.equal(domainMatches("evil.com", "evil.com"), true);
    assert.equal(domainMatches("mail.evil.com", "evil.com"), true);
    assert.equal(domainMatches("a.b.evil.com", "evil.com"), true);
    assert.equal(domainMatches("notevil.com", "evil.com"), false);
    assert.equal(domainMatches("evil.com.attacker.test", "evil.com"), false);
  });

  test("domainIsDisposable matches a bundled domain and its subdomains", () => {
    assert.equal(domainIsDisposable("mailinator.com"), true);
    assert.equal(domainIsDisposable("inbox.mailinator.com"), true);
    assert.equal(domainIsDisposable("example.com"), false);
  });
});
