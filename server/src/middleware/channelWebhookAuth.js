const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const channelService = require("../services/channelService");

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
 * requireTelegramWebhookSecret — gate for the deprecated per bot Telegram route.
 *
 * Kept for one release so bots still pointed at
 * POST /api/channels/telegram/webhook/:botUsername keep delivering while admins
 * reconnect them to the fixed route. It authenticates against the instance wide
 * CHANNEL_TELEGRAM_WEBHOOK_SECRET, which is why it is on its way out: it cannot
 * tell which bot an update came from.
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

/**
 * requireTelegramChannel — per bot authentication for the fixed inbound route.
 *
 * Telegram echoes the secret set at setWebhook time in
 * X-Telegram-Bot-Api-Secret-Token. That secret identifies which bot sent the
 * update, so the channel row is resolved here and put on `req.telegramChannel`.
 * No bot id is read from the URL or trusted from the body.
 *
 * The database lookup narrows the candidate set by exact value; the header is
 * then compared to that row's own secret in constant time, so a hit is verified
 * the same way a miss is rejected. An unknown secret is 401, and a paused
 * channel matches nothing.
 */
const requireTelegramChannel = (req, res, next) => {
  const provided = req.headers["x-telegram-bot-api-secret-token"];
  if (!provided) {
    return next(new ApiError(401, "Invalid or missing webhook secret."));
  }

  channelService
    .findTelegramChannelByWebhookSecret(provided)
    .then((channel) => {
      if (!channel || !safeEqual(provided, channel.webhookSecret)) {
        return next(new ApiError(401, "Invalid or missing webhook secret."));
      }
      req.telegramChannel = channel;
      next();
    })
    .catch(next);
};

module.exports = {
  requireEmailWebhookSecret,
  requireTelegramWebhookSecret,
  requireTelegramChannel,
  safeEqual,
};