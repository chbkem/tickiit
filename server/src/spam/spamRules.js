/**
 * spamRules — the single source of truth for every tunable the public form
 * guard uses. Limits, weights, and the two bundled lists live here so the
 * rules can be tuned in one place without hunting through the guard.
 *
 * The BANNED_TERMS and DISPOSABLE_DOMAINS lists age quickly; review them
 * regularly (see the spec's Follow-up section).
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Server measured fill time. A submission faster than this is quarantined.
const MIN_FILL_MS = 1500;

// Content shape.
const LINK_LIMIT = 2; // more than this many links quarantines.
const REPEATED_PHRASE_MIN_WORDS = 3;
const REPEATED_PHRASE_THRESHOLD = 5; // same phrase this many times quarantines.

// Score at or above this quarantines.
const QUARANTINE_SCORE = 50;

// Per email limits. Counts include ACCEPTED and QUARANTINED attempts only.
const EMAIL_WINDOW_MS = 5 * MINUTE_MS;
const EMAIL_DAILY_LIMIT = 5;
const EMAIL_DAILY_WINDOW_MS = DAY_MS;

// Per IP in process limiter (first cheap gate, route level).
const IP_LIMIT = 20;
const IP_WINDOW_MS = 15 * MINUTE_MS;

// Quarantine flood cap: quarantined tickets per IP per hour before rejecting.
const QUARANTINE_IP_HOURLY = 25;

// Signed form token lifetime and proof of work challenge window.
const FORM_TOKEN_TTL_MS = DAY_MS;
const POW_TTL_MS = 10 * MINUTE_MS;

// Retention.
const ATTEMPT_RETENTION_DAYS = 90;
const QUARANTINE_RETENTION_DAYS = 30;

// Rule weights. Any single rule reaches QUARANTINE_SCORE on its own.
const RULE_WEIGHTS = Object.freeze({
  honeypot: 100,
  min_fill_time: 80,
  banned_term: 100,
  repeated_text: 70,
  link_cap: 60,
});

// Case insensitive substrings. Keep entries specific enough to avoid tripping
// on ordinary support requests.
const BANNED_TERMS = Object.freeze([
  "viagra",
  "cialis",
  "levitra",
  "casino",
  "online gambling",
  "betting bonus",
  "porn",
  "xxx",
  "crypto giveaway",
  "bitcoin giveaway",
  "free bitcoin",
  "forex signals",
  "seo services",
  "buy backlinks",
  "guest post service",
  "make money fast",
  "work from home opportunity",
  "weight loss pills",
  "miracle cure",
  "loan offer",
  "nigerian prince",
]);

// Bundled disposable / throwaway email domains. The BlocklistEntry table is for
// manual operator entries; this list ships with the code.
const DISPOSABLE_DOMAINS = Object.freeze([
  "mailinator.com",
  "guerrillamail.com",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mailnesia.com",
  "spam4.me",
  "mytemp.email",
  "emailondeck.com",
]);

module.exports = {
  MINUTE_MS,
  HOUR_MS,
  DAY_MS,
  MIN_FILL_MS,
  LINK_LIMIT,
  REPEATED_PHRASE_MIN_WORDS,
  REPEATED_PHRASE_THRESHOLD,
  QUARANTINE_SCORE,
  EMAIL_WINDOW_MS,
  EMAIL_DAILY_LIMIT,
  EMAIL_DAILY_WINDOW_MS,
  IP_LIMIT,
  IP_WINDOW_MS,
  QUARANTINE_IP_HOURLY,
  FORM_TOKEN_TTL_MS,
  POW_TTL_MS,
  ATTEMPT_RETENTION_DAYS,
  QUARANTINE_RETENTION_DAYS,
  RULE_WEIGHTS,
  BANNED_TERMS,
  DISPOSABLE_DOMAINS,
};
