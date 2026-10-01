const logger = require("../lib/logger");

/**
 * sendTelegramReply — sends a message to a Telegram chat via the Bot API.
 *
 * Uses the global fetch (Node 18+). The bot token comes from
 * CHANNEL_TELEGRAM_BOT_TOKEN. If the token is not configured, the
 * send is skipped with a warning (no throw: reply dispatch must not
 * fail the comment creation).
 */
const sendTelegramReply = async ({ chatId, text }) => {
  const botToken = process.env.CHANNEL_TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.warn("CHANNEL_TELEGRAM_BOT_TOKEN not set; skipping Telegram reply", { chatId });
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram API error: ${response.status} ${body}`);
  }
};

module.exports = { sendTelegramReply };
