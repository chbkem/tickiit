const crypto = require("crypto");

/**
 * Spam protection secrets. Read from the environment, never hardcoded. In
 * production every secret is required and the server refuses to start without
 * it (assertSpamSecrets, called from src/index.js). In development we fall back
 * to random per process values so the feature works out of the box; those are
 * regenerated on each restart, which is fine for a dev machine.
 */
const SECRET_NAMES = ["FORM_TOKEN_SECRET", "ALTCHA_HMAC_KEY", "SPAM_IP_SALT"];

const DEV_FALLBACKS = SECRET_NAMES.reduce((acc, name) => {
  acc[name] = crypto.randomBytes(32).toString("hex");
  return acc;
}, {});

const isProduction = () => process.env.NODE_ENV === "production";

const readSecret = (name) => {
  const value = process.env[name];
  if (typeof value === "string" && value.trim() !== "") return value;
  if (isProduction()) return "";
  return DEV_FALLBACKS[name];
};

const missingSecrets = () =>
  SECRET_NAMES.filter((name) => {
    const value = process.env[name];
    return !(typeof value === "string" && value.trim() !== "");
  });

/**
 * assertSpamSecrets — fail fast. Called once at startup so a production deploy
 * with a missing secret stops with a clear message instead of silently
 * weakening the form (the spec's key invariant).
 */
const assertSpamSecrets = () => {
  if (!isProduction()) return;
  const missing = missingSecrets();
  if (missing.length > 0) {
    throw new Error(
      `Missing required spam-protection secrets in production: ${missing.join(", ")}. ` +
        "Set each to 32 or more random bytes as hex.",
    );
  }
};

module.exports = {
  SECRET_NAMES,
  isProduction,
  formTokenSecret: () => readSecret("FORM_TOKEN_SECRET"),
  altchaHmacKey: () => readSecret("ALTCHA_HMAC_KEY"),
  spamIpSalt: () => readSecret("SPAM_IP_SALT"),
  missingSecrets,
  assertSpamSecrets,
};
