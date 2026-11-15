const crypto = require("crypto");

/**
 * Signed form token — replaces the old client reported `elapsedMs`. The server
 * signs `{ publicId, issuedAt }` when the form loads and verifies it on submit,
 * so the fill time is measured by the server and cannot be forged by reading
 * the page source.
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
 */

const encode = (value) => Buffer.from(value).toString("base64url");

const signFormToken = (payload, secret) => {
  const body = encode(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
};

const timingSafeEqual = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

/**
 * verifyFormToken — returns { ok: true, payload } or { ok: false, reason }.
 * `reason` is `expired` for a well formed but stale token, `invalid` otherwise.
 * Never throws: a malformed token is a normal rejection, not a 500.
 */
const verifyFormToken = (token, secret, { now = Date.now(), ttlMs } = {}) => {
  if (typeof token !== "string" || token === "") {
    return { ok: false, reason: "missing" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false, reason: "invalid" };
  }

  const [body, signature] = parts;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, reason: "invalid" };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch (_) {
    return { ok: false, reason: "invalid" };
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.publicId !== "string" ||
    typeof payload.issuedAt !== "number" ||
    !Number.isFinite(payload.issuedAt)
  ) {
    return { ok: false, reason: "invalid" };
  }

  if (typeof ttlMs === "number" && now - payload.issuedAt > ttlMs) {
    return { ok: false, reason: "expired", payload };
  }

  return { ok: true, payload };
};

module.exports = { signFormToken, verifyFormToken };
