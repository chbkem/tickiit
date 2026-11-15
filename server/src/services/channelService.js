const prisma = require("../lib/prisma");
const logger = require("../lib/logger");
const ApiError = require("../utils/ApiError");
const {
  encryptSecret,
  decryptSecret,
  canDecryptSecret,
  randomSecret,
} = require("../utils/secretCrypto");
const { buildWebhookUrl } = require("../config/channels");
const telegramService = require("./telegramService");

/**
 * Channel persistence (spec 0003, bring your own Telegram bots).
 *
 * Email channels keep the simple identifier-only shape from 0002. Telegram
 * channels carry their own token, webhook secret, and status on the row, so
 * every function here takes an explicit orgId or row rather than relying on any
 * shared instance state.
 *
 * Telegram ownership rules, all enforced here rather than in the controller:
 *   - one bot id belongs to one organization, across the whole instance
 *   - one bot username belongs to one organization
 *   - a token is write only; no function returns one
 */

// --- Reads -------------------------------------------------------------------

const listChannels = (orgId) =>
  prisma.channel.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

const findChannelById = (id) => prisma.channel.findUnique({ where: { id } });

const findChannelByIdentifier = (channel, identifier) =>
  prisma.channel.findFirst({
    where: { channel, identifier, isActive: true },
  });

/**
 * findChannelByTelegramBotId — every channel holding a bot id, across orgs.
 *
 * The uniqueness check needs this: an org may not claim a bot another org
 * already registered, and the row it collides with may not be in its own org.
 */
const findChannelByTelegramBotId = (telegramBotId) =>
  prisma.channel.findFirst({ where: { telegramBotId } });

/**
 * findTelegramChannelByWebhookSecret — the bot that sent an inbound update.
 *
 * Telegram echoes the per channel secret in X-Telegram-Bot-Api-Secret-Token,
 * so the header alone identifies the bot. This is the lookup the fixed inbound
 * route uses; there is no bot id in the URL or trusted from the body.
 *
 * A paused channel matches nothing, which is what makes the manual pause work:
 * a paused bot stops delivering inbound work without losing its token.
 */
const findTelegramChannelByWebhookSecret = (secret) => {
  if (!secret) return null;
  return prisma.channel.findFirst({
    where: { webhookSecret: secret, channel: "TELEGRAM", isActive: true },
  });
};

/**
 * findTelegramChannels — every Telegram channel, for the startup decrypt sweep.
 */
const findTelegramChannels = () =>
  prisma.channel.findMany({ where: { channel: "TELEGRAM" } });

// --- Serialization -----------------------------------------------------------

/**
 * decryptChannelToken — the bot token for a channel row, or null.
 *
 * The one place a stored token is opened for use. Returns null when nothing is
 * stored or the row will not decrypt, so a caller sends nothing rather than
 * sending garbage to Telegram. Callers already hold the row, so this never
 * crosses a response boundary.
 */
const decryptChannelToken = (channel) => {
  if (!channel?.botTokenCiphertext) return null;
  try {
    return decryptSecret({
      ciphertext: channel.botTokenCiphertext,
      iv: channel.botTokenIv,
      authTag: channel.botTokenAuthTag,
    });
  } catch {
    // No usable key on this instance. Never throws, so reading a channel (or
    // dispatching a reply) degrades to "no token" rather than a 500.
    return null;
  }
};

/**
 * tokenMask — a recognizable but non secret fragment of a stored token.
 *
 * The bot id prefix plus the last three characters, so an admin can tell
 * "is this the token I pasted" without the server ever handing the token back.
 * Null when nothing is stored, so a channel that still needs setup reports no
 * mask rather than an empty one.
 */
const tokenMask = ({ botTokenCiphertext, botTokenIv, botTokenAuthTag }) => {
  if (!botTokenCiphertext) return null;
  let token;
  try {
    token = decryptSecret({
      ciphertext: botTokenCiphertext,
      iv: botTokenIv,
      authTag: botTokenAuthTag,
    });
  } catch {
    // No usable key on this instance: report no mask rather than failing the
    // whole channel list.
    return null;
  }
  // A row that will not decrypt (a rotated key) has no readable mask.
  if (!token) return null;
  const colon = token.indexOf(":");
  if (colon === -1) return null;
  return `${token.slice(0, colon)}:...${token.slice(-3)}`;
};

/**
 * serializeChannel — the one shape every channel route returns.
 *
 * Strips the three token columns and the webhook secret, and adds tokenMask.
 * Because every route goes through this, there is no per route place where an
 * omitted column leaks a credential: a new route gets the safe shape by
 * default.
 */
const serializeChannel = (channel) => {
  if (!channel) return null;
  const {
    botTokenCiphertext,
    botTokenIv,
    botTokenAuthTag,
    webhookSecret,
    ...safe
  } = channel;
  return {
    ...safe,
    tokenMask: tokenMask({ botTokenCiphertext, botTokenIv, botTokenAuthTag }),
  };
};

const serializeChannels = (channels) => channels.map(serializeChannel);

// --- Status ------------------------------------------------------------------

/**
 * stampStatus — record the outcome of a send or verify on the channel.
 *
 * `message` is plain words safe to show an admin; the raw Telegram error body is
 * logged by telegramService, never stored here, because it can echo the chat id
 * and customer text. Failure to stamp is logged and swallowed: losing a status
 * write must not lose the send result the caller is about to report.
 */
const stampStatus = async (id, status, message = null) => {
  try {
    return await prisma.channel.update({
      where: { id },
      data: { status, statusMessage: message, statusCheckedAt: new Date() },
    });
  } catch (error) {
    logger.warn("Could not stamp channel status", {
      channelId: id,
      status,
      errorMessage: error.message,
    });
    return null;
  }
};

/**
 * stampSendFailure — mark a channel ERROR after a send or verify failed.
 *
 * A revoked token (Telegram 401 or 404) is the case this exists for: it used to
 * be silent, and the point of the status column is that it is not.
 */
const stampSendFailure = async (id, error) => {
  const revoked = typeof error?.isRevoked === "function" && error.isRevoked();
  const message = revoked
    ? "Telegram rejected this bot token (401 or 404). It was likely revoked. Paste a new token to recover."
    : truncateMessage(error?.message ?? "The last Telegram call failed.");
  return stampStatus(id, "ERROR", message);
};

const truncateMessage = (value, max = 300) =>
  typeof value === "string" && value.length > max ? `${value.slice(0, max)}...` : value;

/**
 * sweepUndecryptableChannels — startup check after a key rotation.
 *
 * A key that is present and well formed but different from the one that
 * encrypted existing rows leaves those rows unreadable. Nothing is lost: each
 * channel is marked ERROR with a message saying the key changed, and an admin
 * recovers it by pasting the token again.
 */
const sweepUndecryptableChannels = async ({ key, db = prisma } = {}) => {
  const channels = await db.channel.findMany({ where: { channel: "TELEGRAM" } });
  let marked = 0;

  for (const channel of channels) {
    if (!channel.botTokenCiphertext) continue;
    const readable = canDecryptSecret(
      {
        ciphertext: channel.botTokenCiphertext,
        iv: channel.botTokenIv,
        authTag: channel.botTokenAuthTag,
      },
      key,
    );
    if (readable) continue;

    await db.channel.update({
      where: { id: channel.id },
      data: {
        status: "ERROR",
        statusMessage:
          "The stored bot token cannot be decrypted: CHANNEL_ENCRYPTION_KEY appears to have changed. Paste the token again to recover.",
        statusCheckedAt: new Date(),
      },
    });
    marked += 1;
    logger.warn("Marked Telegram channel ERROR: stored token will not decrypt", {
      channelId: channel.id,
      orgId: channel.orgId,
      identifier: channel.identifier,
    });
  }

  if (marked > 0) {
    logger.warn(`${marked} Telegram channel(s) marked ERROR because their token could not be decrypted. An admin must paste each token again.`);
  }
  return marked;
};

// --- Audit -------------------------------------------------------------------

/**
 * recordAudit — a credential change trail.
 *
 * channelId carries no foreign key, so the row survives the channel being
 * deleted and the record of who removed a bot outlives the bot. No token ever
 * reaches this table.
 */
const recordAudit = ({ channelId, orgId, botUsername, action, actorId }) =>
  prisma.channelAudit.create({
    data: { channelId, orgId, botUsername, action, actorId },
  });

// --- Connect and rotate ------------------------------------------------------

/**
 * connectTelegramBot — register a bot and point it at this deployment.
 *
 * One function serves both creating a channel and replacing a token on an
 * existing one, so verification and registration are written once and cannot
 * drift apart. The order matters and is deliberate:
 *
 *   1. ask Telegram who this bot is (getMe). Nothing is written until this
 *      succeeds, so a bad token never leaves a half written row behind.
 *   2. check the bot id is free across the whole instance.
 *   3. encrypt the token and generate this channel's own webhook secret.
 *   4. read the current webhook, then register ours, reporting whether we took
 *      the bot over from a previous URL.
 *   5. write the row, then the audit entry.
 *
 * A failure at any step records ERROR with a message an admin can act on, and
 * the token columns are left as they were (never half written).
 */
const connectTelegramBot = async ({
  orgId,
  actorId,
  botToken,
  channelId = null,
  db = prisma,
  env = process.env,
  telegram = telegramService,
  logger: log = logger,
}) => {
  const existing = channelId ? await db.channel.findUnique({ where: { id: channelId } }) : null;
  if (channelId && !existing) {
    throw new ApiError(404, "Channel not found.");
  }
  if (existing && existing.orgId !== orgId) {
    // Same rule as the other channel routes: not found rather than forbidden,
    // so a caller cannot probe another org's channel ids.
    throw new ApiError(404, "Channel not found.");
  }
  if (existing && existing.channel !== "TELEGRAM") {
    throw new ApiError(400, "That channel is not a Telegram bot.");
  }

  // 1. Ask Telegram who this bot is. Nothing is persisted until this succeeds.
  let me;
  try {
    me = await telegram.getMe({ token: botToken });
  } catch (error) {
    await recordConnectFailure({ db, existing, log, error });
    const failure = telegramConnectFailure(
      error,
      "Telegram rejected that bot token. Check it in BotFather and paste it again.",
    );
    throw new ApiError(failure.statusCode, failure.message, {
      reason: telegramErrorDetail(error),
    });
  }

  if (!me || me.id === undefined || me.id === null) {
    await recordConnectFailure({ db, existing, log, error: new Error("getMe returned no bot.") });
    throw new ApiError(400, "Telegram did not return a bot for that token.");
  }

  const telegramBotId = String(me.id);
  // A bot with no username still needs a stable identifier. `bot<numeric id>` is
  // unique because the numeric id is.
  const identifier = me.username ? String(me.username) : `bot${telegramBotId}`;

  // 2. One bot id belongs to one organization, across the whole instance.
  const botIdOwner = await db.channel.findFirst({
    where: { telegramBotId, ...(existing ? { NOT: { id: existing.id } } : {}) },
  });
  if (botIdOwner) {
    throw new ApiError(
      409,
      botIdOwner.orgId === orgId
        ? "That bot is already connected to this organization."
        : "That bot already belongs to another organization.",
    );
  }

  // 3. Seal the token and mint this channel's own inbound secret.
  const { ciphertext, iv, authTag } = encryptSecret(botToken);
  const webhookSecret = randomSecret(32);
  const webhookUrl = buildWebhookUrl(null, env);

  // 4. Read the current webhook, then register ours.
  let reclaimedWebhook = false;
  try {
    const info = await telegram.getWebhookInfo({ token: botToken });
    const currentUrl = info?.url ?? "";
    reclaimedWebhook = currentUrl !== "" && currentUrl !== webhookUrl;

    await telegram.setWebhook({ token: botToken, url: webhookUrl, secretToken: webhookSecret });
  } catch (error) {
    await recordConnectFailure({ db, existing, log, error });
    const failure = telegramConnectFailure(
      error,
      "Telegram rejected the webhook registration for that bot. Check the token in BotFather and paste it again.",
    );
    throw new ApiError(failure.statusCode, failure.message, {
      reason: telegramErrorDetail(error),
    });
  }

  // 5. Write the row. A create and a rotate write the same shape.
  const data = {
    identifier,
    displayName: me.first_name ?? null,
    telegramBotId,
    botTokenCiphertext: ciphertext,
    botTokenIv: iv,
    botTokenAuthTag: authTag,
    webhookSecret,
    status: "ACTIVE",
    statusMessage: null,
    statusCheckedAt: new Date(),
  };

  const saved = existing
    ? await db.channel.update({ where: { id: existing.id }, data })
    : await db.channel.create({ data: { ...data, orgId, channel: "TELEGRAM" } });

  await recordAudit({
    channelId: saved.id,
    orgId,
    botUsername: identifier,
    action: existing ? "ROTATE" : "CONNECT",
    actorId,
  });

  log.info(existing ? "Telegram bot token rotated" : "Telegram bot connected", {
    channelId: saved.id,
    orgId,
    identifier,
    reclaimedWebhook,
  });

  return { channel: saved, reclaimedWebhook };
};

/**
 * recordConnectFailure — mark a channel ERROR after getMe or setWebhook failed.
 *
 * The row is kept (a rotate must not lose the channel and its tickets) but no
 * token is written, so there is never a half written credential. On create there
 * is no row to mark, which is why the failure is only logged.
 */
const recordConnectFailure = async ({ db, existing, log, error }) => {
  log.warn("Telegram bot connection failed", {
    channelId: existing?.id ?? null,
    identifier: existing?.identifier ?? null,
    status: error?.status ?? null,
    errorMessage: truncateMessage(error?.message ?? String(error)),
  });
  if (!existing) return;
  await db.channel.update({
    where: { id: existing.id },
    data: {
      status: "ERROR",
      statusMessage: telegramErrorDetail(error),
      statusCheckedAt: new Date(),
    },
  });
};

/**
 * telegramErrorDetail — the message shown to an admin on the channel row.
 *
 * Kept to plain words and capped. The raw Telegram body stays in the log.
 */
const telegramErrorDetail = (error) => {
  const base =
    typeof error?.message === "string" && error.message
      ? error.message
      : "Telegram rejected the request.";
  return truncateMessage(base, 300);
};

/**
 * telegramConnectFailure — classify a failed Bot API call on the connect path.
 *
 * The status Telegram sent back decides what an admin is told. A 401 or 404 is a
 * genuine rejection, so `rejectedMessage` (pointing at BotFather) is right and the
 * status stays 400. A null status means the request never got an answer at all:
 * a timeout, refused connection, or DNS failure. That says nothing about the
 * token, and reporting it as a rejection sends the admin off to replace a token
 * that was always fine, which is why this case is a 502 and names the network.
 *
 * Any other status already carries Telegram's own wording, so it is passed
 * through rather than relabelled as a token problem.
 */
const telegramConnectFailure = (error, rejectedMessage) => {
  const revoked = typeof error?.isRevoked === "function" && error.isRevoked();
  if (revoked) {
    return { statusCode: 400, message: rejectedMessage };
  }
  if (error?.status === null || error?.status === undefined) {
    return {
      statusCode: 502,
      message:
        "Telegram could not be reached from this server, so the bot token was never checked. Check this server's network access to api.telegram.org, then try again.",
    };
  }
  return {
    statusCode: 400,
    message: telegramErrorDetail(error) || rejectedMessage,
  };
};

// --- Simple mutations --------------------------------------------------------

const createChannel = ({ orgId, channel, identifier }) =>
  prisma.channel.create({
    data: { orgId, channel, identifier },
  });

const updateChannel = (id, data) =>
  prisma.channel.update({
    where: { id },
    data,
  });

/**
 * deleteChannel — remove a channel and leave an audit record behind.
 *
 * Deleting a bot destroys its token irrecoverably, and its tickets keep their
 * history but lose the link, so replies on them can no longer be sent. Pausing
 * is the reversible option and keeps both.
 */
const deleteChannel = async ({ id, orgId, actorId, db = prisma }) => {
  const channel = await db.channel.findUnique({ where: { id } });
  if (!channel || channel.orgId !== orgId) {
    throw new ApiError(404, "Channel not found.");
  }

  await db.channel.delete({ where: { id } });
  await db.channelAudit.create({
    data: {
      channelId: id,
      orgId,
      botUsername: channel.identifier,
      action: "DELETE",
      actorId,
    },
  });

  return channel;
};

/**
 * sendTestMessage — send one message through a channel's own bot.
 *
 * The admin supplies the chat id, since only they know which chat to try. The
 * result is reported either way, and a revoked token stamps the channel ERROR
 * so it shows up in the table without anyone reading a log.
 */
const sendTestMessage = async ({ channelId, orgId, chatId, db = prisma, telegram = telegramService }) => {
  const channel = await db.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.orgId !== orgId) {
    throw new ApiError(404, "Channel not found.");
  }
  if (channel.channel !== "TELEGRAM") {
    throw new ApiError(400, "That channel is not a Telegram bot.");
  }

  const token = decryptChannelToken(channel);
  if (!token) {
    const message = channel.botTokenCiphertext
      ? "The stored bot token cannot be decrypted. Paste a new token to recover."
      : "No bot token is stored yet. Paste a token to finish setup.";
    await stampStatus(channel.id, "ERROR", message);
    throw new ApiError(422, message);
  }

  try {
    const result = await telegram.sendMessage({
      token,
      chatId,
      text: "Test message from your support bot. Telegram intake is connected.",
    });
    await stampStatus(channel.id, "ACTIVE", null);
    return { sent: Boolean(result?.sent ?? result?.ok), messageId: result?.messageId ?? null };
  } catch (error) {
    await stampSendFailure(channel.id, error);
    const detail = telegramErrorDetail(error);
    throw new ApiError(502, detail, { status: error?.status ?? null });
  }
};

module.exports = {
  listChannels,
  findChannelById,
  findChannelByIdentifier,
  findChannelByTelegramBotId,
  findTelegramChannelByWebhookSecret,
  findTelegramChannels,
  serializeChannel,
  serializeChannels,
  decryptChannelToken,
  stampStatus,
  stampSendFailure,
  sweepUndecryptableChannels,
  recordAudit,
  connectTelegramBot,
  createChannel,
  updateChannel,
  deleteChannel,
  sendTestMessage,
};