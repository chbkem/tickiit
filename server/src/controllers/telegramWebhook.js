const ApiError = require("../utils/ApiError");
const asyncHandler = require("../middleware/asyncHandler");
const channelService = require("../services/channelService");
const ingestionService = require("../services/ingestionService");
const ticketService = require("../services/ticketService");
const { runTriage } = require("../ai/pipeline/runTriage");
const { buildName } = require("../ai/identity");

/**
 * telegramWebhook — handles inbound Telegram updates.
 *
 * Only text messages create tickets. Non-text messages (photos, stickers,
 * documents) are ignored. The bot username in the path identifies the channel.
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

  const externalId = message.message_id;
  const existing = await ingestionService.recordIngestion({
    channel: "TELEGRAM",
    externalId,
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
    },
  });

  // Store the chat id so agent replies are dispatched back to the customer.
  await ticketService.updateTicket(result.ticket.id, { channelRecipient: chatId });

  await ingestionService.markIngestionWithTicket(existing.id, result.ticket.id);

  res.json({ ok: true, ticketId: result.ticket.id });
});
