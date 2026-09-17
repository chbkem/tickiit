const crypto = require("crypto");
const ApiError = require("../utils/ApiError");

const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * requireIngestToken — shared-secret gate for channel adapters/webhooks.
 * Supports `Authorization: Bearer <token>` or `x-ingest-token`. No configured
 * token means the ingest surface is disabled (503). Constant-time comparison
 * against an env secret; rotating it takes effect on the next request.
 */
const requireIngestToken = (req, res, next) => {
  const expected = process.env.AI_INGEST_TOKEN;
  if (!expected) {
    return next(new ApiError(503, "Ingestion is not configured on this instance."));
  }
  const provided =
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? req.headers["x-ingest-token"];
  if (!safeEqual(provided, expected)) {
    return next(new ApiError(401, "Invalid or missing ingestion token."));
  }
  next();
};

module.exports = requireIngestToken;