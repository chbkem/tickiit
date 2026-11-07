const asyncHandler = require("../middleware/asyncHandler");
const channelService = require("../services/channelService");
const ingestionService = require("../services/ingestionService");
const ticketService = require("../services/ticketService");
const { runTriage } = require("../ai/pipeline/runTriage");
const { buildName } = require("../ai/identity");

/**
 * handleTelegramUpdate — inbound Telegram updates on the one fixed URL.
 *
 * The bot is already resolved and authenticated by requireTelegramChannel from
 * the X-Telegram-Bot-Api-Secret-Token header, so there is no bot identifier in
 * the path here.
 *
 * Ticket creation rules:
 *   - private chat text creates a ticket (AC-7)
 *   - group, supergroup, and channel chats create none (AC-7)
 *   - non text messages create none (AC-7)
 *   - slash commands are text, so they create a ticket like anything else (AC-8)
 * Ignored updates still answer 200, otherwise Telegram retries them forever.
 */
exports.handleTelegramUpdate = asyncHandler(async (req, res) => {
  const channel = req.telegramChannel;
  const { message } = req.body;

  if (!message || !message.text) {
    return res.json({ ok: true });
  }
  if (message.chat?.type !== "private") {
    return res.json({ ok: true });
  }

  // Dedup is per (channel, message_id): two bots both receive message_id 5 and
  // each must create its own ticket (AC-12).
  const existing = await ingestionService.recordIngestion({
    channel: "TELEGRAM",
    externalId: message.message_id,
    channelId: channel.id,
  });
  if (!existing) {
    return res.json({ ok: true });
  }

  const from = message.from;
  const name = buildName(from.first_name, from.last_name);
  const chatId = String(message.chat.id);

  const result = await runTriage({
    input: {
      raw: message.text,
      channel: "TELEGRAM",
      requesterRef: String(from.id),
      name,
      orgId: channel.orgId,
      channelId: channel.id,
    },
  });

  // Store the chat id so agent replies are dispatched back to the customer.
  await ticketService.updateTicket(result.ticket.id, {
    channelRecipient: chatId,
    channelId: channel.id,
  });

  await ingestionService.markIngestionWithTicket(existing.id, result.ticket.id);

  res.json({ ok: true, ticketId: result.ticket.id });
});

/**
 * handleTelegramWebhook — the deprecated per bot route.
 *
 * POST /api/channels/telegram/webhook/:botUsername, authenticated by the
 * instance wide CHANNEL_TELEGRAM_WEBHOOK_SECRET. Kept for one release so bots
 * still pointed at it keep delivering while admins reconnect them to the fixed
 * URL; it will not survive the tighten phase.
 */
exports.handleTelegramWebhook = asyncHandler(async (req, res) => {
  const { message } = req.body;

  if (!message || !message.text) {
    return res.json({ ok: true });
  }

  const botUsername = req.params.botUsername;
  const channel = await channelService.findChannelByIdentifier("TELEGRAM", botUsername);
  if (!channel) {
    return res.json({ ok: true });
  }

  const existing = await ingestionService.recordIngestion({
    channel: "TELEGRAM",
    externalId: message.message_id,
    channelId: channel.id,
  });
  if (!existing) {
    return res.json({ ok: true });
  }

  const from = message.from;
  const name = buildName(from.first_name, from.last_name);
  const chatId = String(message.chat.id);

  const result = await runTriage({
    input: {
      raw: message.text,
      channel: "TELEGRAM",
      requesterRef: String(from.id),
      name,
      orgId: channel.orgId,
      channelId: channel.id,
    },
  });

  await ticketService.updateTicket(result.ticket.id, {
    channelRecipient: chatId,
    channelId: channel.id,
  });

  await ingestionService.markIngestionWithTicket(existing.id, result.ticket.id);

  res.json({ ok: true, ticketId: result.ticket.id });
});