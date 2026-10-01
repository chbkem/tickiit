const express = require("express");
const channelsController = require("../controllers/channels");
const emailWebhookController = require("../controllers/emailWebhook");
const telegramWebhookController = require("../controllers/telegramWebhook");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { createLimiter } = require("../middleware/rateLimit");
const { requireEmailWebhookSecret, requireTelegramWebhookSecret } = require("../middleware/channelWebhookAuth");
const {
  createChannelSchema,
  updateChannelSchema,
  deleteChannelSchema,
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

// Public intake webhooks. Authenticated by shared secret / Telegram token,
// not by a Clerk session, so they are mounted before requireAuth.
router.post(
  "/email/webhook",
  webhookLimiter,
  requireEmailWebhookSecret,
  validate(emailWebhookSchema),
  emailWebhookController.handleEmailWebhook,
);
router.post(
  "/telegram/webhook/:botUsername",
  webhookLimiter,
  requireTelegramWebhookSecret,
  validate(telegramWebhookSchema),
  telegramWebhookController.handleTelegramWebhook,
);

// Channel management (org admin, Clerk session).
router.use(requireAuth);

router.get("/", channelsController.listChannels);
router.post("/", writeLimiter, validate(createChannelSchema), channelsController.createChannel);
router.patch("/:id", writeLimiter, validate(updateChannelSchema), channelsController.updateChannel);
router.delete("/:id", writeLimiter, validate(deleteChannelSchema), channelsController.deleteChannel);

module.exports = router;
