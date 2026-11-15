/**
 * contentScreen — pure, side effect free content checks. No database, no
 * environment, no clock: everything here is a function of its inputs, which
 * makes the rules easy to reason about and cheap to unit test.
 */

const {
  BANNED_TERMS,
  LINK_LIMIT,
  REPEATED_PHRASE_MIN_WORDS,
  REPEATED_PHRASE_THRESHOLD,
  RULE_WEIGHTS,
} = require("./spamRules");

// http(s)://... and www.... are counted as links. Bare domains are left out so
// ordinary prose ("see example.com docs") does not inflate the count.
const URL_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

const countLinks = (...texts) =>
  texts.reduce((total, text) => {
    if (typeof text !== "string") return total;
    const matches = text.match(URL_PATTERN);
    return total + (matches ? matches.length : 0);
  }, 0);

/**
 * normalizeBody — a stable comparison key for a message: lowercased, with
 * punctuation and extra whitespace collapsed. Used for repetition counting and
 * for matching a body against stored attempts.
 */
const normalizeBody = (text) => {
  if (typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const findBannedTerms = (text, terms = BANNED_TERMS) => {
  if (typeof text !== "string" || text === "") return [];
  const haystack = text.toLowerCase();
  return terms.filter((term) => haystack.includes(term.toLowerCase()));
};

/**
 * maxPhraseRepetition — the highest number of times any contiguous phrase of
 * REPEATED_PHRASE_MIN_WORDS..6 words repeats in the message. Single words are
 * excluded on purpose: common words repeat in ordinary text and would produce
 * false positives.
 */
const maxPhraseRepetition = (text) => {
  const tokens = normalizeBody(text).split(" ").filter(Boolean);
  if (tokens.length < REPEATED_PHRASE_MIN_WORDS) return 0;

  const counts = new Map();
  for (let n = REPEATED_PHRASE_MIN_WORDS; n <= 6; n += 1) {
    for (let i = 0; i + n <= tokens.length; i += 1) {
      const phrase = tokens.slice(i, i + n).join(" ");
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }
  }

  let max = 0;
  for (const value of counts.values()) {
    if (value > max) max = value;
  }
  return max;
};

/**
 * screenContent — folds the content rules into one { reasons, score } result.
 * Reasons are stable ids (link_cap, banned_term, repeated_text) recorded on the
 * attempt and the quarantined ticket.
 */
const screenContent = ({ subject, message }) => {
  const reasons = [];
  let score = 0;

  const links = countLinks(subject, message);
  if (links > LINK_LIMIT) {
    reasons.push("link_cap");
    score += RULE_WEIGHTS.link_cap;
  }

  if (findBannedTerms(`${subject || ""} ${message || ""}`).length > 0) {
    reasons.push("banned_term");
    score += RULE_WEIGHTS.banned_term;
  }

  if (maxPhraseRepetition(message) >= REPEATED_PHRASE_THRESHOLD) {
    reasons.push("repeated_text");
    score += RULE_WEIGHTS.repeated_text;
  }

  return { reasons, score };
};

module.exports = {
  URL_PATTERN,
  countLinks,
  normalizeBody,
  findBannedTerms,
  maxPhraseRepetition,
  screenContent,
};
