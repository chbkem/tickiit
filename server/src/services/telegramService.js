const logger = require("../lib/logger");

/**
 * Telegram Bot API client (spec 0003).
 *
 * One small wrapper over four methods, each taking the token as an argument
 * rather than reading it from the environment. The token belongs to the channel
 * row, so every call site decides which bot it is acting as; there is no shared
 * instance token left in this file.
 *
 * Every call is bounded at five seconds. That ceiling now applies per bot rather
 * than once per instance, and a Telegram hang must never hold a reply request
 * open: agent replies sit on the request path.
 */

const BASE_URL = "https://api.telegram.org";
// Ten seconds, not five. A warm call to the Bot API lands in 150 to 800ms, but a
// cold one carries a fresh DNS lookup and TLS handshake on top of that, and this
// process can have its event loop blocked by the embedding model (see
// ai/knowledge/embedder.js) while a request is in flight. Aborting at 5s
// turned that contention into a spurious "Telegram rejected this bot token".
const REQUEST_TIMEOUT_MS = 10000;

/**
 * TelegramApiError — a Bot API call that came back with ok:false or a non 2xx.
 *
 * `status` is the HTTP status, which is what tells a revoked token (401) apart
 * from a chat that no longer exists (404). `body` is the raw response text,
 * truncated because Telegram error bodies can echo the chat id and whatever
 * customer text was involved.
 */
class TelegramApiError extends Error {
  constructor(message, { method, status, body } = {}) {
    super(message);
    this.name = "TelegramApiError";
    this.method = method;
    this.status = status ?? null;
    this.body = body ?? "";
  }

  /**
   * isRevoked — 401 or 404 on an authenticated call. Both mean the token no
   * longer works, which is the signal to mark the channel ERROR and ask an
   * admin for a new token.
   */
  isRevoked() {
    return this.status === 401 || this.status === 404;
  }
}

// Telegram error bodies are short but can carry customer text; cap them so a
// log line and a statusMessage both stay bounded.
const truncate = (value, max = 300) =>
  typeof value === "string" && value.length > max ? `${value.slice(0, max)}...` : value ?? "";

/**
 * callTelegram — one Bot API request.
 *
 * `fetchImpl` is injectable so tests can drive the client without network
 * access. The token appears in the URL and is never logged.
 */
const callTelegram = async (method, { token, body, fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS }) => {
  if (!token) {
    throw new TelegramApiError("No Telegram bot token is stored for this channel.", {
      method,
      status: null,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchImpl(`${BASE_URL}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
  } catch (error) {
    // Deliberately no URL or token in this message.
    const timedOut = error?.name === "AbortError";
    throw new TelegramApiError(
      timedOut
        ? `Telegram ${method} timed out after ${timeoutMs}ms.`
        : `Telegram ${method} could not be reached.`,
      { method, status: null },
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    logger.warn("Telegram API call failed", {
      method,
      status: response.status,
      body: truncate(text),
    });
    throw new TelegramApiError(
      response.status === 401 || response.status === 404
        ? "Telegram rejected this bot token. Paste a new token to reconnect."
        : `Telegram ${method} failed with status ${response.status}.`,
      { method, status: response.status, body: truncate(text) },
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new TelegramApiError(`Telegram ${method} returned a response that is not JSON.`, {
      method,
      status: response.status,
      body: truncate(text),
    });
  }
};

/**
 * getMe — confirms the token and returns who the bot actually is.
 *
 * This is what replaces typing a username by hand: the server asks Telegram for
 * the bot's real numeric id, username, and first name, so the stored row cannot
 * disagree with the bot it points at.
 */
const getMe = ({ token, fetchImpl, timeoutMs } = {}) =>
  callTelegram("getMe", { token, fetchImpl, timeoutMs }).then((payload) => payload.result ?? null);

/**
 * getWebhookInfo — where Telegram currently sends this bot's updates.
 *
 * Read before registering, so a bot already pointed at another deployment is
 * reported to the admin as reclaimed rather than silently taken over.
 */
const getWebhookInfo = ({ token, fetchImpl, timeoutMs } = {}) =>
  callTelegram("getWebhookInfo", { token, fetchImpl, timeoutMs }).then((payload) => payload.result ?? null);

/**
 * setWebhook — points the bot at this deployment with a per channel secret.
 *
 * `secretToken` is what Telegram echoes back in
 * X-Telegram-Bot-Api-Secret-Token, and it is how an inbound update is matched
 * to the bot that sent it. There is no manual BotFather step: the admin pastes
 * a token and this runs.
 */
const setWebhook = ({ token, url, secretToken, fetchImpl, timeoutMs } = {}) =>
  callTelegram("setWebhook", {
    token,
    body: { url, secret_token: secretToken, allowed_updates: ["message"] },
    fetchImpl,
    timeoutMs,
  }).then((payload) => payload.result ?? null);

/**
 * sendMessage — sends one message to one chat through one bot.
 *
 * `chatId` is the numeric Telegram chat id stored on the ticket. `parseMode` is
 * deliberately left unset: agent replies pass through sanitizeText on the way
 * in, which strips markup, so treating the text as plain keeps Telegram from
 * rejecting a reply that contains a stray underscore or asterisk.
 */
const sendMessage = ({ token, chatId, text, fetchImpl, timeoutMs } = {}) =>
  callTelegram("sendMessage", {
    token,
    body: { chat_id: chatId, text },
    fetchImpl,
    timeoutMs,
  }).then((payload) => ({
    messageId: payload.result?.message_id ?? null,
    ok: payload.ok !== false,
  }));

/**
 * sendTelegramReply — the reply dispatch entry point.
 *
 * The caller passes the token belonging to the ticket's own channel, so an
 * agent's reply goes out through the bot the customer wrote to. Throws
 * TelegramApiError; the dispatcher decides what a failure means for the
 * channel's status.
 */
const sendTelegramReply = async ({ token, chatId, text, fetchImpl, timeoutMs }) =>
  sendMessage({ token, chatId, text, fetchImpl, timeoutMs });

module.exports = {
  BASE_URL,
  REQUEST_TIMEOUT_MS,
  TelegramApiError,
  callTelegram,
  getMe,
  getWebhookInfo,
  setWebhook,
  sendMessage,
  sendTelegramReply,
};