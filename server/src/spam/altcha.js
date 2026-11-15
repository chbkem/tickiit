const { createChallenge, verifySolution } = require("altcha-lib");
const { deriveKey } = require("altcha-lib/algorithms/pbkdf2");
const { altchaHmacKey } = require("./config");
const { POW_TTL_MS } = require("./spamRules");

/**
 * Self hosted proof of work, using the official Altcha server library. The
 * widget (client) fetches a challenge here, solves it in the browser, and sends
 * the base64 payload back on submit; we verify it with the same HMAC key.
 *
 * PBKDF2/SHA-256 is the widget's default algorithm and is bundled, so no extra
 * worker import is needed on the client.
 */
const ALGORITHM = "PBKDF2/SHA-256";
const COST = 5000;

const createPowChallenge = () =>
  createChallenge({
    algorithm: ALGORITHM,
    cost: COST,
    deriveKey,
    hmacSignatureSecret: altchaHmacKey(),
    expiresAt: new Date(Date.now() + POW_TTL_MS),
  });

/**
 * decodePowPayload — the widget sends base64(JSON({ challenge, solution })).
 * Returns null for anything that is not that shape so callers can treat it as
 * an invalid payload without throwing.
 */
const decodePowPayload = (payload) => {
  if (typeof payload !== "string" || payload === "") return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (!decoded || typeof decoded !== "object") return null;
    return decoded;
  } catch (_) {
    return null;
  }
};

/**
 * verifyPow — true only for a well formed, unexpired, correctly signed solution.
 * Any failure (missing, malformed, tampered, expired) resolves to false so the
 * guard records `pow_invalid` (AC-6).
 */
const verifyPow = async (payload) => {
  const decoded = decodePowPayload(payload);
  if (!decoded || !decoded.challenge || !decoded.solution) return false;

  try {
    const result = await verifySolution({
      challenge: decoded.challenge,
      solution: decoded.solution,
      deriveKey,
      hmacSignatureSecret: altchaHmacKey(),
    });
    return Boolean(result && result.verified && !result.expired);
  } catch (_) {
    return false;
  }
};

module.exports = { ALGORITHM, COST, createPowChallenge, decodePowPayload, verifyPow };
