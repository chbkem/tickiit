const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  MIN_FILL_MS,
  isHoneypotFilled,
  isSubmittedTooFast,
} = require("./formGuard");

describe("formGuard", () => {
  test("detects a filled honeypot", () => {
    assert.equal(isHoneypotFilled(""), false);
    assert.equal(isHoneypotFilled("   "), false);
    assert.equal(isHoneypotFilled(undefined), false);
    assert.equal(isHoneypotFilled("https://spam.example"), true);
  });

  test("rejects submissions faster than the minimum fill time", () => {
    assert.equal(isSubmittedTooFast(MIN_FILL_MS - 1), true);
    assert.equal(isSubmittedTooFast(0), true);
    assert.equal(isSubmittedTooFast(MIN_FILL_MS), false);
    assert.equal(isSubmittedTooFast(60_000), false);
  });

  test("ignores a missing or malformed elapsed time", () => {
    assert.equal(isSubmittedTooFast(undefined), false);
    assert.equal(isSubmittedTooFast("not-a-number"), false);
    assert.equal(isSubmittedTooFast(Number.NaN), false);
  });
});
