require("dotenv").config();
const { SMTPServer } = require("smtp-server");
const logger = require("../lib/logger");

/**
 * Local SMTP server for inbound email intake (Slice 1).
 *
 * Receives email on CHANNEL_SMTP_HOST:CHANNEL_SMTP_PORT and forwards each
 * message to the email webhook over HTTP, authenticated by the shared secret.
 * The webhook (not this process) owns dedup, triage, and ticket creation, so
 * this server only parses the envelope and hands off.
 *
 * Plain text only (AC-10): the body is everything after the first blank line.
 * HTML and multipart MIME are not parsed.
 */

const {
  CHANNEL_SMTP_HOST = "127.0.0.1",
  CHANNEL_SMTP_PORT = "2525",
  CHANNEL_SMTP_WEBHOOK_SECRET,
  CHANNEL_SMTP_WEBHOOK_URL = "http://localhost:5000/api/channels/email/webhook",
} = process.env;

// Minimal plain-text email parser. Returns subject, messageId, and body.
const parseEmail = (raw) => {
  const splitAt = raw.search(/\r?\n\r?\n/);
  const headerPart = splitAt === -1 ? raw : raw.slice(0, splitAt);
  const body = splitAt === -1 ? "" : raw.slice(splitAt).replace(/^\r?\n\r?\n/, "");
  const headers = {};
  for (const line of headerPart.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9-]+):\s?(.*)$/);
    if (match) headers[match[1].toLowerCase()] = match[2].trim();
  }
  return {
    subject: headers["subject"] ?? "",
    messageId: (headers["message-id"] ?? "").replace(/[<>]/g, ""),
    body,
  };
};

const forwardToWebhook = async ({ from, to, subject, body, messageId }) => {
  const response = await fetch(CHANNEL_SMTP_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": CHANNEL_SMTP_WEBHOOK_SECRET,
    },
    body: JSON.stringify({ from, to, subject, body, messageId }),
  });
  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status} ${await response.text().catch(() => "")}`);
  }
};

const server = new SMTPServer({
  // Local intake server: the webhook secret is the trust boundary, not SMTP auth.
  authOptional: true,
  onData(stream, session, callback) {
    let raw = "";
    stream.on("data", (chunk) => {
      raw += chunk;
    });
    stream.on("end", () => {
      const from = session.envelope.mailFrom?.address ?? "";
      const to = session.envelope.rcptTo?.[0]?.address ?? "";
      const { subject, messageId, body } = parseEmail(raw);
      forwardToWebhook({ from, to, subject, body, messageId })
        .then(() => callback())
        .catch((error) => {
          // Accept and log: a failed forward must not bounce customer mail.
          // Dedup and retries are the webhook's concern (v2).
          logger.error("Failed to forward inbound email to webhook", {
            from,
            to,
            errorMessage: error.message,
          });
          callback();
        });
    });
  },
});

if (!CHANNEL_SMTP_WEBHOOK_SECRET) {
  logger.warn("CHANNEL_SMTP_WEBHOOK_SECRET is not set; the email webhook will reject forwards with 503.");
}

server.listen(Number(CHANNEL_SMTP_PORT), CHANNEL_SMTP_HOST, () => {
  logger.info(`SMTP intake server listening on ${CHANNEL_SMTP_HOST}:${CHANNEL_SMTP_PORT}`);
});
