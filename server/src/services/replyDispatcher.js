const logger = require("../lib/logger");
const emailService = require("./emailService");
const telegramService = require("./telegramService");
const channelService = require("./channelService");

/**
 * dispatchReply — sends an agent reply back to the customer's channel.
 *
 * Reads Ticket.source and Ticket.channelRecipient to determine the transport.
 * If the ticket has no channelRecipient or the source is not a known channel,
 * the reply is not dispatched (web tickets have no channel to dispatch to).
 *
 * Telegram replies go out through the ticket's own bot: Ticket.channelId points
 * at the Channel row that holds that bot's token (spec 0003). A ticket whose
 * channelId is null has no token to use, so the send is skipped and logged
 * rather than thrown: web tickets never reach here, but a Telegram ticket whose
 * bot was deleted does.
 *
 * Dispatch failures are logged but never throw: a failed reply must not fail the
 * comment creation that triggered it.
 */
const dispatchReply = async (ticket, commentBody) => {
  if (!ticket.channelRecipient) return;

  const source = ticket.source;
  try {
    if (source === "EMAIL") {
      await emailService.sendEmailReply({
        to: ticket.channelRecipient,
        subject: `Re: ${ticket.subject}`,
        body: commentBody,
      });
      logger.info("Email reply dispatched", {
        ticketId: ticket.id,
        recipient: ticket.channelRecipient,
      });
    } else if (source === "TELEGRAM") {
      const channel = await channelService.findChannelById(ticket.channelId);
      if (!channel) {
        logger.warn("Skipping Telegram reply: no channel row for this ticket", {
          ticketId: ticket.id,
          channelId: ticket.channelId ?? null,
        });
        return;
      }

      const token = channelService.decryptChannelToken(channel);
      if (!token) {
        logger.warn("Skipping Telegram reply: no readable bot token for this ticket", {
          ticketId: ticket.id,
          channelId: channel.id,
        });
        return;
      }

      await telegramService.sendTelegramReply({
        token,
        chatId: ticket.channelRecipient,
        text: commentBody,
      });
      await channelService.stampStatus(channel.id, "ACTIVE", null);

      logger.info("Telegram reply dispatched", {
        ticketId: ticket.id,
        chatId: ticket.channelRecipient,
        channelId: channel.id,
      });
    }
  } catch (error) {
    // A revoked or broken token marks the channel ERROR so the dashboard shows
    // it (AC-9). The comment itself is already saved by the time we get here.
    if (source === "TELEGRAM" && ticket.channelId) {
      await channelService.stampSendFailure(ticket.channelId, error).catch(() => {});
    }
    logger.error("Failed to dispatch reply", {
      ticketId: ticket.id,
      source,
      errorMessage: error.message,
    });
  }
};

module.exports = { dispatchReply };