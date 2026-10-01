const logger = require("../lib/logger");
const emailService = require("./emailService");
const telegramService = require("./telegramService");

/**
 * dispatchReply — sends an agent reply back to the customer's channel.
 *
 * Reads Ticket.source and Ticket.channelRecipient to determine the transport.
 * If the ticket has no channelRecipient or the source is not a known channel,
 * the reply is not dispatched (web tickets have no channel to dispatch to).
 *
 * Dispatch failures are logged but never throw: a failed reply must not
 * fail the comment creation that triggered it.
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
      await telegramService.sendTelegramReply({
        chatId: ticket.channelRecipient,
        text: commentBody,
      });
      logger.info("Telegram reply dispatched", {
        ticketId: ticket.id,
        chatId: ticket.channelRecipient,
      });
    }
  } catch (error) {
    logger.error("Failed to dispatch reply", {
      ticketId: ticket.id,
      source,
      errorMessage: error.message,
    });
  }
};

module.exports = { dispatchReply };
