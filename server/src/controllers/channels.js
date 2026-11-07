const { getAuth } = require("@clerk/express");

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../middleware/asyncHandler");
const channelService = require("../services/channelService");
const { assertUserIsAdminInOrganization } = require("../services/clerkService");

/**
 * Channel management (org admin, Clerk session).
 *
 * Every function here authorizes, then delegates. A bot token is a credential,
 * so all of these are admin only, reusing the same check as the rest of the
 * server: a non admin member of the organization can neither see nor change one.
 *
 * Every response goes through channelService.serializeChannel, so no route can
 * accidentally return a ciphertext, an iv, an auth tag, or the webhook secret.
 */

/** requireOrgAdmin — the shared gate: in an organization, and an admin of it. */
const requireOrgAdmin = (req) => {
  const { orgId, userId, orgRole } = getAuth(req);
  if (!orgId) {
    throw new ApiError(403, "You must be in an organization to manage channels.");
  }
  return { orgId, userId, orgRole };
};

const assertAdmin = async ({ userId, orgId, orgRole }) => {
  await assertUserIsAdminInOrganization({
    userId,
    orgId,
    sessionOrgId: orgId,
    sessionOrgRole: orgRole,
  });
};

/**
 * Telegram connect failures are a server misconfiguration (no encryption key, no
 * public base URL), not a client mistake, so they answer 503 rather than 400.
 */
const withConfigMapping = (handler) => asyncHandler(async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isChannelConfigError(error)) {
      return next(new ApiError(503, error.message));
    }
    throw error;
  }
});

const isChannelConfigError = (error) =>
  typeof error?.message === "string" &&
  (error.message.includes("CHANNEL_ENCRYPTION_KEY") ||
    error.message.includes("CHANNEL_PUBLIC_BASE_URL"));

exports.listChannels = asyncHandler(async (req, res) => {
  const auth = requireOrgAdmin(req);
  await assertAdmin(auth);

  const channels = await channelService.listChannels(auth.orgId);
  res.json(channelService.serializeChannels(channels));
});

/**
 * createChannel — email by identifier, Telegram by bot token.
 *
 * For Telegram the server asks Telegram who the bot is and registers the webhook
 * itself, so the admin pastes one field and there is no BotFather step. The
 * `reclaimedWebhook` flag says the bot was pointed somewhere else and this
 * deployment took it over.
 */
exports.createChannel = withConfigMapping(async (req, res) => {
  const auth = requireOrgAdmin(req);
  await assertAdmin(auth);

  const { channel, identifier, botToken } = req.body;

  if (channel === "TELEGRAM") {
    const { channel: saved, reclaimedWebhook } = await channelService.connectTelegramBot({
      orgId: auth.orgId,
      actorId: auth.userId,
      botToken,
    });
    return res.status(201).json({
      ...channelService.serializeChannel(saved),
      reclaimedWebhook,
    });
  }

  const existing = await channelService.findChannelByIdentifier(channel, identifier);
  if (existing) {
    throw new ApiError(409, "A channel with this identifier already exists.");
  }

  const created = await channelService.createChannel({
    orgId: auth.orgId,
    channel,
    identifier,
  });
  res.status(201).json(channelService.serializeChannel(created));
});

/**
 * rotateTelegramToken — replace the token on an existing bot.
 *
 * The recovery path for a revoked token: the channel, its tickets, and its
 * inbound URL all survive, and only the credential changes.
 */
exports.rotateTelegramToken = withConfigMapping(async (req, res) => {
  const auth = requireOrgAdmin(req);
  await assertAdmin(auth);

  const { channel, reclaimedWebhook } = await channelService.connectTelegramBot({
    orgId: auth.orgId,
    actorId: auth.userId,
    botToken: req.body.botToken,
    channelId: req.params.id,
  });

  res.json({ ...channelService.serializeChannel(channel), reclaimedWebhook });
});

/**
 * testChannelSend — send one message through a bot to a chat the admin names.
 *
 * Reports what Telegram said, and stamps the channel ERROR when the token was
 * rejected, so a broken bot shows up in the table rather than in a log.
 */
exports.testChannelSend = withConfigMapping(async (req, res) => {
  const auth = requireOrgAdmin(req);
  await assertAdmin(auth);

  const result = await channelService.sendTestMessage({
    channelId: req.params.id,
    orgId: auth.orgId,
    chatId: req.body.chatId,
  });

  res.json(result);
});

/**
 * updateChannel — pause or resume. This is the manual switch, independent of the
 * bot's own status: a paused channel keeps its token and matches no inbound
 * update, and sends no reply.
 */
exports.updateChannel = asyncHandler(async (req, res) => {
  const auth = requireOrgAdmin(req);
  await assertAdmin(auth);

  const channel = await channelService.findChannelById(req.params.id);
  if (!channel || channel.orgId !== auth.orgId) {
    throw new ApiError(404, "Channel not found.");
  }

  const updated = await channelService.updateChannel(req.params.id, req.body);
  res.json(channelService.serializeChannel(updated));
});

/**
 * deleteChannel — remove a channel and leave an audit record behind.
 */
exports.deleteChannel = asyncHandler(async (req, res) => {
  const auth = requireOrgAdmin(req);
  await assertAdmin(auth);

  await channelService.deleteChannel({
    id: req.params.id,
    orgId: auth.orgId,
    actorId: auth.userId,
  });

  res.status(204).send();
});