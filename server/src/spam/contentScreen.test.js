const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  countLinks,
  normalizeBody,
  findBannedTerms,
  maxPhraseRepetition,
  screenContent,
} = require("./contentScreen");
const { LINK_LIMIT, RULE_WEIGHTS } = require("./spamRules");

describe("contentScreen", () => {
  test("counts http, https, and www links across subject and message", () => {
    assert.equal(countLinks("see https://a.example", "and http://b.example plus www.c.example"), 3);
    assert.equal(countLinks("no links here", "just prose"), 0);
  });

  test("does not count bare domains so ordinary prose is safe", () => {
    assert.equal(countLinks("", "check example.com docs"), 0);
  });

  test("ignores non-string inputs", () => {
    assert.equal(countLinks(undefined, null, "https://a.example"), 1);
  });

  test("normalizes a body for stable comparison", () => {
    assert.equal(normalizeBody("  Hello,   World!!  "), "hello world");
    assert.equal(normalizeBody("A-B_C"), "a b c");
    assert.equal(normalizeBody(undefined), "");
  });

  test("finds banned terms case-insensitively", () => {
    assert.deepEqual(findBannedTerms("Buy VIAGRA now"), ["viagra"]);
    assert.deepEqual(findBannedTerms("ordinary request"), []);
    assert.deepEqual(findBannedTerms(""), []);
  });

  test("counts repeated phrases but not repeated single words", () => {
    assert.equal(maxPhraseRepetition("a b c a b c a b c a b c a b c"), 5);
    // "the" appears three times, but single-word repeats are ignored, so no
    // 3-word phrase repeats here.
    assert.equal(maxPhraseRepetition("the cat the dog the bird"), 1);
  });

  test("returns no reasons and no score for ordinary content", () => {
    const result = screenContent({
      subject: "Cannot sign in",
      message: "I keep getting a 500 error after I enter my password.",
    });
    assert.deepEqual(result, { reasons: [], score: 0 });
  });

  test("flags a banned term with its weight", () => {
    const result = screenContent({ subject: "Cheap casino chips", message: "click here" });
    assert.ok(result.reasons.includes("banned_term"));
    assert.equal(result.score, RULE_WEIGHTS.banned_term);
  });

  test("flags a repeated phrase", () => {
    const result = screenContent({
      subject: "hi",
      message: "buy cheap coins now buy cheap coins now buy cheap coins now buy cheap coins now buy cheap coins now",
    });
    assert.ok(result.reasons.includes("repeated_text"));
    assert.equal(result.score, RULE_WEIGHTS.repeated_text);
  });

  test("keeps the link cap strictly greater than LINK_LIMIT", () => {
    const atLimit = Array.from({ length: LINK_LIMIT }, (_, i) => `https://${i}.example`).join(" ");
    assert.deepEqual(screenContent({ subject: "", message: atLimit }).reasons, []);

    const overLimit = screenContent({
      subject: "",
      message: `${atLimit} https://extra.example`,
    });
    assert.ok(overLimit.reasons.includes("link_cap"));
    assert.equal(overLimit.score, RULE_WEIGHTS.link_cap);
  });
});
