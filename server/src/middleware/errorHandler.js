const { getAuth } = require("@clerk/express");
const ApiError = require("../utils/ApiError");
const logger = require("../lib/logger");

const PRISMA_ERROR_MESSAGES = {
  P2002: [409, "A record with the same unique value already exists."],
  P2023: [400, "The provided ID is not a valid identifier."],
  P2025: [404, "The requested resource does not exist."],
};

const sanitizeBody = (body) => {
  if (!body || typeof body !== "object") return undefined;
  const sanitized = {};
  for (const [key, value] of Object.entries(body)) {
    if (/password|secret|token|key/i.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

const collectRequestContext = (req) => {
  let userId;
  try {
    userId = getAuth(req)?.userId;
  } catch (_) {
    // middleware not mounted or no session
  }

  return {
    method: req.method,
    url: req.originalUrl,
    params: req.params,
    query: Object.keys(req.query).length ? req.query : undefined,
    userId,
    ip: req.ip,
    userAgent: req.get("user-agent"),
    body: sanitizeBody(req.body),
  };
};

const notFoundHandler = (req, res) => {
  logger.warn("Route not found", collectRequestContext(req));
  res.status(404).json({ error: "Not found." });
};

const errorHandler = (error, req, res, next) => {
  const ctx = collectRequestContext(req);

  if (error instanceof ApiError) {
    logger.warn("API error", { ...ctx, statusCode: error.statusCode, errorMessage: error.message, details: error.details });
    const payload = { error: error.message };
    if (error.details !== undefined) payload.details = error.details;
    return res.status(error.statusCode).json(payload);
  }

  if (error && typeof error.code === "string" && error.code.startsWith("P")) {
    const mapped = PRISMA_ERROR_MESSAGES[error.code];
    if (mapped) {
      logger.error("Prisma error", { ...ctx, statusCode: mapped[0], errorMessage: mapped[1], originalCode: error.code, originalMessage: error.message });
      return res.status(mapped[0]).json({ error: mapped[1] });
    }
  }

  if (error && typeof error.status === "number") {
    logger.error("Identity provider error", { ...ctx, statusCode: 502, upstreamStatus: error.status, errorMessage: error.message, clerkCode: error.code });
    return res.status(502).json({ error: "Identity provider unavailable." });
  }

  logger.error("Unhandled error", { ...ctx, statusCode: 500, errorMessage: error.message, stack: error.stack, errorCode: error.code });
  res.status(500).json({ error: "Internal server error" });
};

module.exports = { notFoundHandler, errorHandler };