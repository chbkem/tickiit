const rateLimit = require("express-rate-limit");
const logger = require("../lib/logger");

let warnedOnce = false;

/**
 * createLimiter — single factory for every rate limiter in the app so the
 * configuration stays consistent (headers, legacy flags, error shape).
 *
 * express-rate-limit's default store keeps counters in process memory: that is
 * accurate for one instance, but each replica resets its own counters when the
 * app is scaled out. Swap the store (e.g. rate-limit-redis sharing a Redis) in
 * ONE place here before running multiple instances; we log a one-time warning
 * in production so the limitation is never silent.
 */
const createLimiter = ({ windowMs, limit, message }) => {
  if (!warnedOnce && process.env.NODE_ENV === "production") {
    warnedOnce = true;
    logger.warn(
      "Rate limiter uses the in-process memory store; counts are not shared across instances. " +
        "Add a shared store (e.g. rate-limit-redis) before scaling out.",
    );
  }
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message,
  });
};

module.exports = { createLimiter };