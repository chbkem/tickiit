const attemptService = require("../services/attemptService");
const blocklistService = require("../services/blocklistService");
const { formTokenSecret, spamIpSalt } = require("./config");
const { hashIp, hashEmail, hashBody, emailDomain } = require("./hash");
const { verifyFormToken } = require("./formToken");
const { verifyPow } = require("./altcha");
const { screenContent } = require("./contentScreen");
const {
  MIN_FILL_MS,
  RULE_WEIGHTS,
  QUARANTINE_SCORE,
  EMAIL_WINDOW_MS,
  EMAIL_DAILY_LIMIT,
  EMAIL_DAILY_WINDOW_MS,
  QUARANTINE_IP_HOURLY,
  HOUR_MS,
  FORM_TOKEN_TTL_MS,
} = require("./spamRules");

const MESSAGES = Object.freeze({
  blocklisted: "We could not accept this submission. If you think this is a mistake, contact support directly.",
  bad_form_token: "Your form session has expired. Please reload the page and try again.",
  pow_invalid: "Please complete the verification step before submitting.",
  duplicate_window: "You already submitted a request recently. We will follow up on it soon.",
  email_daily_limit: "You have reached the submission limit for today. Please try again tomorrow.",
  quarantine_flood: "Too many submissions from your network. Please try again later.",
});

const defaultDeps = { attemptService, blocklistService, verifyPow };

const isHoneypotFilled = (website) =>
  typeof website === "string" && website.trim() !== "";

/**
 * evaluateSubmission — decides exactly one verdict (ACCEPTED, QUARANTINED,
 * REJECTED) for a public form submission. It performs no writes; the caller
 * records the attempt and creates the ticket from the returned verdict.
 *
 * Order (the spec's guard order, with the quarantine flood cap applied as a
 * gate on every quarantine so a bot flood cannot grow the table):
 *   1. blocklist            -> REJECTED
 *   2. signed form token    -> REJECTED (bad_form_token)
 *   3. proof of work        -> REJECTED (pow_invalid)
 *   4. honey pot / fill time-> quarantine signals
 *   5. per email duplicate  -> REJECTED (429)
 *   6. per email daily limit-> REJECTED (429)
 *   7. content score        -> quarantine signals (including a repeated body
 *                              from a different email)
 *   8. quarantine flood cap -> REJECTED (429) when a quarantine is pending
 */
const evaluateSubmission = async ({ form, body, ip, now = Date.now(), deps = defaultDeps }) => {
  const { email, subject, message, website, formToken, altcha } = body;

  const salt = spamIpSalt();
  const identity = {
    ipHash: hashIp(ip, salt),
    emailHash: email ? hashEmail(email, salt) : null,
    emailDomain: email ? emailDomain(email) : null,
    bodyHash: message ? hashBody(message, salt) : null,
  };

  const reject = (reason, status, message, extra = {}) => ({
    verdict: "REJECTED",
    reasons: [reason],
    score: 0,
    status,
    message,
    ...identity,
    ...extra,
  });

  // 1. Blocklist: email, domain (with subdomains), IP hash.
  const blocklistMatch = await deps.blocklistService.findBlocklistMatch({
    email,
    domain: identity.emailDomain,
    ipHash: identity.ipHash,
    now: new Date(now),
  });
  if (blocklistMatch) {
    return reject("blocklisted", 400, MESSAGES.blocklisted);
  }

  // 2. Signed form token (server measured fill time source).
  const token = verifyFormToken(formToken, formTokenSecret(), {
    now,
    ttlMs: FORM_TOKEN_TTL_MS,
  });
  if (!token.ok || !token.payload || token.payload.publicId !== form.publicId) {
    return reject("bad_form_token", 400, MESSAGES.bad_form_token);
  }
  const fillMs = now - token.payload.issuedAt;

  // 3. Proof of work.
  const powOk = await deps.verifyPow(altcha);
  if (!powOk) {
    return reject("pow_invalid", 400, MESSAGES.pow_invalid);
  }

  // 4 + 7. Quarantine signals: honey pot, fill time, content shape.
  const quarantineReasons = [];
  let score = 0;

  if (isHoneypotFilled(website)) {
    quarantineReasons.push("honeypot");
    score += RULE_WEIGHTS.honeypot;
  }
  if (fillMs < MIN_FILL_MS) {
    quarantineReasons.push("min_fill_time");
    score += RULE_WEIGHTS.min_fill_time;
  }

  const content = screenContent({ subject, message });
  if (content.reasons.length > 0) {
    quarantineReasons.push(...content.reasons);
    score += content.score;
  }

  // Same normalized body from a different email inside the window (AC-12).
  if (identity.bodyHash) {
    const repeated = await deps.attemptService.findRecentCountedByBodyHash({
      bodyHash: identity.bodyHash,
      emailHash: identity.emailHash,
      since: new Date(now - EMAIL_DAILY_WINDOW_MS),
    });
    if (repeated && !quarantineReasons.includes("repeated_text")) {
      quarantineReasons.push("repeated_text");
      score += RULE_WEIGHTS.repeated_text;
    }
  }

  // 5. Per email duplicate window.
  if (identity.emailHash) {
    const recent = await deps.attemptService.findRecentCountedByEmail({
      emailHash: identity.emailHash,
      since: new Date(now - EMAIL_WINDOW_MS),
    });
    if (recent) {
      const ticketNumber = await deps.attemptService.findTicketNumber(recent.ticketId);
      const message = ticketNumber
        ? `You already submitted a request recently (ticket ${ticketNumber}). We will follow up on it soon.`
        : MESSAGES.duplicate_window;
      return reject("duplicate_window", 429, message, { ticketNumber });
    }
  }

  // 6. Per email daily limit.
  if (identity.emailHash) {
    const count = await deps.attemptService.countCountedByEmail({
      emailHash: identity.emailHash,
      since: new Date(now - EMAIL_DAILY_WINDOW_MS),
    });
    if (count >= EMAIL_DAILY_LIMIT) {
      return reject("email_daily_limit", 429, MESSAGES.email_daily_limit);
    }
  }

  if (quarantineReasons.length > 0) {
    // 8. Quarantine flood cap: reject instead of growing the table.
    const ipQuarantines = await deps.attemptService.countQuarantinedByIp({
      ipHash: identity.ipHash,
      since: new Date(now - HOUR_MS),
    });
    if (ipQuarantines >= QUARANTINE_IP_HOURLY) {
      return reject("quarantine_flood", 429, MESSAGES.quarantine_flood);
    }

    return {
      verdict: "QUARANTINED",
      reasons: quarantineReasons,
      score,
      ...identity,
    };
  }

  return { verdict: "ACCEPTED", reasons: [], score: 0, ...identity };
};

module.exports = {
  MESSAGES,
  QUARANTINE_SCORE,
  isHoneypotFilled,
  evaluateSubmission,
};
