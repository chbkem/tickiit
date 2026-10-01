const crypto = require("crypto");
const ApiError = require("../utils/ApiError");

const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * requireEmailWebhookSecret — shared-secret gate for the email intake webhook.
 *
 * The local SMTP server forwards inbound mail to the webhook and sends the
 * org's shared secret in `x-webhook-secret`. No configured secret means the
 * email channel is disabled (503), matching the AI_INGEST_TOKEN convention.
 * Constant-time comparison against the env secret.
 */
const requireEmailWebhookSecret = (req, res, next) => {
  const expected = process.env.CHANNEL_SMTP_WEBHOOK_SECRET;
  if (!expected) {
    return next(new ApiError(503, "Email webhook is not configured on this instance."));
  }
  const provided = req.headers["x-webhook-secret"];
  if (!safeEqual(provided, expected)) {
    return next(new ApiError(401, "Invalid or missing webhook secret."));
  }
  next();
};

/**
 * requireTelegramWebhookSecret — gate for the Telegram webhook.
 *
 * Telegram sends the secret token you configure when you register the webhook
 * in the `X-Telegram-Bot-Api-Secret-Token` header. No configured secret means
 * the Telegram channel is disabled (503).
 */
const requireTelegramWebhookSecret = (req, res, next) => {
  const expected = process.env.CHANNEL_TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    return next(new ApiError(503, "Telegram webhook is not configured on this instance."));
  }
  const provided = req.headers["x-telegram-bot-api-secret-token"];
  if (!safeEqual(provided, expected)) {
    return next(new ApiError(401, "Invalid or missing webhook secret."));
  }
  next();
};

module.exports = { requireEmailWebhookSecret, requireTelegramWebhookSecret };
