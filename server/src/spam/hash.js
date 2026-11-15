const crypto = require("crypto");
const { normalizeBody } = require("./contentScreen");

const sha256Hex = (value) => crypto.createHash("sha256").update(value).digest("hex");

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

/**
 * The attempt log stores only salted hashes plus the email domain, never the
 * raw IP or raw email (AC-16). The salt comes from SPAM_IP_SALT.
 */
const hashIp = (ip, salt) => sha256Hex(`${salt}:ip:${ip || ""}`);

const hashEmail = (email, salt) => sha256Hex(`${salt}:email:${normalizeEmail(email)}`);

/**
 * A salted hash of the normalized message body. Storing the hash (not the raw
 * body) lets the guard spot the same text arriving from a different email
 * (AC-12) without keeping a second copy of user content in the attempt log.
 */
const hashBody = (text, salt) => sha256Hex(`${salt}:body:${normalizeBody(text)}`);

/** The part after the last @ of a validated email, lowercased. */
const emailDomain = (email) => {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at === -1) return null;
  const domain = normalized.slice(at + 1);
  return domain === "" ? null : domain;
};

module.exports = { sha256Hex, normalizeEmail, hashIp, hashEmail, hashBody, emailDomain };
