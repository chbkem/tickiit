const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { evaluateSubmission } = require("./guard");
const { signFormToken } = require("./formToken");
const { formTokenSecret } = require("./config");
const {
  MIN_FILL_MS,
  EMAIL_DAILY_LIMIT,
  QUARANTINE_IP_HOURLY,
  RULE_WEIGHTS,
} = require("./spamRules");

const PUBLIC_ID = "abcdefghijklmnop";
const form = { id: "form-1", publicId: PUBLIC_ID, orgId: "org-1" };

const makeDeps = (overrides = {}) => ({
  blocklistService: {
    findBlocklistMatch: async () => null,
    ...(overrides.blocklistService || {}),
  },
  verifyPow: overrides.verifyPow || (async () => true),
  attemptService: {
    findRecentCountedByEmail: async () => null,
    countCountedByEmail: async () => 0,
    countQuarantinedByIp: async () => 0,
    findRecentCountedByBodyHash: async () => null,
    findTicketNumber: async () => null,
    ...(overrides.attemptService || {}),
  },
});

const token = (issuedAt) =>
  signFormToken({ publicId: PUBLIC_ID, issuedAt }, formTokenSecret());

const validBody = (overrides = {}) => ({
  name: "Ada",
  email: "ada@example.com",
  subject: "Cannot sign in",
  message: "Please help me reset my password.",
  website: "",
  formToken: token(Date.now() - 5000),
  altcha: "payload",
  ...overrides,
});

describe("guard", () => {
  test("accepts a normal submission and stores only hashes and the domain", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody(),
      ip: "203.0.113.7",
      deps: makeDeps(),
    });

    assert.equal(decision.verdict, "ACCEPTED");
    assert.equal(decision.reasons.length, 0);
    assert.equal(decision.score, 0);
    assert.equal(decision.emailDomain, "example.com");
    assert.match(decision.ipHash, /^[0-9a-f]{64}$/);
    assert.match(decision.emailHash, /^[0-9a-f]{64}$/);
    assert.ok(!decision.ipHash.includes("203.0.113.7"));
    assert.ok(!decision.emailHash.includes("ada"));
  });

  test("quarantines a filled honey pot with a quarantine score (AC-3, AC-14)", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody({ website: "https://spam.example" }),
      ip: "203.0.113.7",
      deps: makeDeps(),
    });

    assert.equal(decision.verdict, "QUARANTINED");
    assert.ok(decision.reasons.includes("honeypot"));
    assert.ok(decision.score >= RULE_WEIGHTS.honeypot);
  });

  test("quarantines a submission faster than the server measured fill time (AC-4)", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody({ formToken: token(Date.now() - (MIN_FILL_MS - 500)) }),
      ip: "203.0.113.7",
      deps: makeDeps(),
    });

    assert.equal(decision.verdict, "QUARANTINED");
    assert.ok(decision.reasons.includes("min_fill_time"));
  });

  test("rejects a missing, tampered, or expired form token (AC-5)", async () => {
    const missing = await evaluateSubmission({
      form,
      body: validBody({ formToken: undefined }),
      ip: "203.0.113.7",
      deps: makeDeps(),
    });
    assert.equal(missing.verdict, "REJECTED");
    assert.deepEqual(missing.reasons, ["bad_form_token"]);
    assert.equal(missing.status, 400);

    const tampered = await evaluateSubmission({
      form,
      body: validBody({ formToken: `${token(Date.now())}x` }),
      ip: "203.0.113.7",
      deps: makeDeps(),
    });
    assert.equal(tampered.verdict, "REJECTED");
    assert.deepEqual(tampered.reasons, ["bad_form_token"]);

    const expired = await evaluateSubmission({
      form,
      body: validBody({ formToken: token(Date.now() - 25 * 60 * 60 * 1000) }),
      ip: "203.0.113.7",
      deps: makeDeps(),
    });
    assert.equal(expired.verdict, "REJECTED");
    assert.deepEqual(expired.reasons, ["bad_form_token"]);
  });

  test("rejects a token minted for a different form", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody({
        formToken: signFormToken(
          { publicId: "someone-else", issuedAt: Date.now() },
          formTokenSecret(),
        ),
      }),
      ip: "203.0.113.7",
      deps: makeDeps(),
    });
    assert.equal(decision.verdict, "REJECTED");
    assert.deepEqual(decision.reasons, ["bad_form_token"]);
  });

  test("rejects a missing or invalid proof of work payload (AC-6)", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody({ altcha: undefined }),
      ip: "203.0.113.7",
      deps: makeDeps({ verifyPow: async () => false }),
    });
    assert.equal(decision.verdict, "REJECTED");
    assert.deepEqual(decision.reasons, ["pow_invalid"]);
    assert.equal(decision.status, 400);
  });

  test("rejects a duplicate inside the window and names the earlier ticket (AC-7)", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody(),
      ip: "203.0.113.7",
      deps: makeDeps({
        attemptService: {
          findRecentCountedByEmail: async () => ({ ticketId: "t-1" }),
          findTicketNumber: async () => "#0042",
        },
      }),
    });
    assert.equal(decision.verdict, "REJECTED");
    assert.deepEqual(decision.reasons, ["duplicate_window"]);
    assert.equal(decision.status, 429);
    assert.ok(decision.message.includes("#0042"));
  });

  test("rejects past the per email daily limit (AC-8)", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody(),
      ip: "203.0.113.7",
      deps: makeDeps({
        attemptService: { countCountedByEmail: async () => EMAIL_DAILY_LIMIT },
      }),
    });
    assert.equal(decision.verdict, "REJECTED");
    assert.deepEqual(decision.reasons, ["email_daily_limit"]);
    assert.equal(decision.status, 429);
  });

  test("rejects a blocklisted sender (AC-13)", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody(),
      ip: "203.0.113.7",
      deps: makeDeps({
        blocklistService: { findBlocklistMatch: async () => ({ kind: "DOMAIN" }) },
      }),
    });
    assert.equal(decision.verdict, "REJECTED");
    assert.deepEqual(decision.reasons, ["blocklisted"]);
    assert.equal(decision.status, 400);
  });

  test("quarantines more than two links (AC-10)", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody({
        message: "See https://a.example https://b.example https://c.example",
      }),
      ip: "203.0.113.7",
      deps: makeDeps(),
    });
    assert.equal(decision.verdict, "QUARANTINED");
    assert.ok(decision.reasons.includes("link_cap"));
  });

  test("quarantines a banned term (AC-11)", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody({ subject: "Cheap Viagra now" }),
      ip: "203.0.113.7",
      deps: makeDeps(),
    });
    assert.equal(decision.verdict, "QUARANTINED");
    assert.ok(decision.reasons.includes("banned_term"));
  });

  test("quarantines a repeated phrase (AC-12)", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody({
        message: "buy cheap coins now buy cheap coins now buy cheap coins now buy cheap coins now buy cheap coins now",
      }),
      ip: "203.0.113.7",
      deps: makeDeps(),
    });
    assert.equal(decision.verdict, "QUARANTINED");
    assert.ok(decision.reasons.includes("repeated_text"));
  });

  test("quarantines the same body seen from a different email (AC-12)", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody(),
      ip: "203.0.113.7",
      deps: makeDeps({
        attemptService: {
          findRecentCountedByBodyHash: async () => ({ id: "attempt-1" }),
        },
      }),
    });
    assert.equal(decision.verdict, "QUARANTINED");
    assert.ok(decision.reasons.includes("repeated_text"));
    assert.ok(decision.score >= RULE_WEIGHTS.repeated_text);
  });

  test("stores a salted body hash, never the raw message (AC-12, AC-16)", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody(),
      ip: "203.0.113.7",
      deps: makeDeps(),
    });
    assert.match(decision.bodyHash, /^[0-9a-f]{64}$/);
    assert.ok(!decision.bodyHash.includes("password"));
  });

  test("rejects instead of quarantining past the flood cap (AC-19)", async () => {
    const decision = await evaluateSubmission({
      form,
      body: validBody({ website: "spam" }),
      ip: "203.0.113.7",
      deps: makeDeps({
        attemptService: { countQuarantinedByIp: async () => QUARANTINE_IP_HOURLY },
      }),
    });
    assert.equal(decision.verdict, "REJECTED");
    assert.deepEqual(decision.reasons, ["quarantine_flood"]);
    assert.equal(decision.status, 429);
  });
});
