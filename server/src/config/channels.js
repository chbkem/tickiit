const { readEncryptionKey } = require("../utils/secretCrypto");

/**
 * Channel configuration for bring your own Telegram bots (spec 0003).
 *
 * Two variables, both required before an admin can connect a bot:
 *   CHANNEL_ENCRYPTION_KEY    32 bytes of base64, the aes-256-gcm key
 *   CHANNEL_PUBLIC_BASE_URL   the public https origin Telegram is pointed back at
 *
 * An absent value returns null so the process can still start and the rest of
 * the API keeps working; the token endpoints answer 503 with a clear message and
 * the startup sweep logs a warning. A value that is present but wrong does throw
 * at startup, because that is a misconfiguration rather than an unbuilt feature.
 */

const WEBHOOK_PATH = "/api/channels/telegram/webhook";

const readPublicBaseUrl = (env = process.env) => {
  const raw = env.CHANNEL_PUBLIC_BASE_URL;
  if (raw === undefined || String(raw).trim() === "") return null;

  const value = String(raw).trim().replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "CHANNEL_PUBLIC_BASE_URL must be a public https origin, for example https://support.example.com",
    );
  }

  // Telegram refuses a webhook that is not https, so a http value would fail
  // at setWebhook with an opaque error. Failing at startup names the variable.
  if (parsed.protocol !== "https:") {
    throw new Error(
      `CHANNEL_PUBLIC_BASE_URL must use https (Telegram requires it for webhooks); got ${parsed.protocol}//`,
    );
  }
  return value;
};

const getChannelConfig = (env = process.env) => ({
  encryptionKey: readEncryptionKey(env),
  publicBaseUrl: readPublicBaseUrl(env),
  webhookPath: WEBHOOK_PATH,
});

/**
 * buildWebhookUrl — the single inbound URL every bot on this instance shares.
 *
 * The bot that sent an update is identified by its own secret in the header,
 * never by the path, so one URL serves every channel.
 */
const buildWebhookUrl = (publicBaseUrl, env = process.env) => {
  const base = publicBaseUrl ?? readPublicBaseUrl(env);
  if (!base) {
    throw new Error(
      "CHANNEL_PUBLIC_BASE_URL is not set, so the Telegram webhook URL cannot be built.",
    );
  }
  return `${base}${WEBHOOK_PATH}`;
};

/**
 * assertChannelConfig — the startup gate.
 *
 * Throws on a present but malformed value. Returns a report the caller logs so
 * a missing value is visible without being fatal.
 */
const assertChannelConfig = (env = process.env) => {
  const { encryptionKey, publicBaseUrl } = getChannelConfig(env);
  const missing = [];
  if (!encryptionKey) missing.push("CHANNEL_ENCRYPTION_KEY");
  if (!publicBaseUrl) missing.push("CHANNEL_PUBLIC_BASE_URL");
  return { encryptionKey, publicBaseUrl, missing };
};

module.exports = {
  WEBHOOK_PATH,
  getChannelConfig,
  buildWebhookUrl,
  assertChannelConfig,
};