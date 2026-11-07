const express = require("express");
const channelsController = require("../controllers/channels");
const emailWebhookController = require("../controllers/emailWebhook");
const telegramWebhookController = require("../controllers/telegramWebhook");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { createLimiter } = require("../middleware/rateLimit");
const {
  requireEmailWebhookSecret,
  requireTelegramWebhookSecret,
  requireTelegramChannel,
} = require("../middleware/channelWebhookAuth");
const {
  createChannelSchema,
  updateChannelSchema,
  deleteChannelSchema,
  rotateTelegramTokenSchema,
  testChannelSendSchema,
  emailWebhookSchema,
  telegramWebhookSchema,
} = require("../validators/channelSchemas");

const router = express.Router();

const writeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { error: "Too many requests, please try again later." },
});

const webhookLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: { error: "Too many requests, please try again later." },
});

// Public intake webhooks. Authenticated by the per channel secret, not by a
// Clerk session, so they are mounted before requireAuth.
//
// The fixed route serves every bot on this instance. Telegram echoes the secret
// set at setWebhook time, which is what identifies the sending bot.
router.post(
  "/telegram/webhook",
  webhookLimiter,
  requireTelegramChannel,
  validate(telegramWebhookSchema),
  telegramWebhookController.handleTelegramUpdate,
);

// Deprecated, kept for one release so bots still pointed here keep delivering
// while admins reconnect them to the fixed route. Removed in the tighten phase.
router.post(
  "/telegram/webhook/:botUsername",
  webhookLimiter,
  requireTelegramWebhookSecret,
  validate(telegramWebhookSchema),
  telegramWebhookController.handleTelegramWebhook,
);

router.post(
  "/email/webhook",
  webhookLimiter,
  requireEmailWebhookSecret,
  validate(emailWebhookSchema),
  emailWebhookController.handleEmailWebhook,
);

// Channel management (org admin, Clerk session).
router.use(requireAuth);

router.get("/", channelsController.listChannels);
router.post("/", writeLimiter, validate(createChannelSchema), channelsController.createChannel);
router.post(
  "/:id/telegram/token",
  writeLimiter,
  validate(rotateTelegramTokenSchema),
  channelsController.rotateTelegramToken,
);
router.post(
  "/:id/test",
  writeLimiter,
  validate(testChannelSendSchema),
  channelsController.testChannelSend,
);
router.patch("/:id", writeLimiter, validate(updateChannelSchema), channelsController.updateChannel);
router.delete("/:id", writeLimiter, validate(deleteChannelSchema), channelsController.deleteChannel);

module.exports = router;