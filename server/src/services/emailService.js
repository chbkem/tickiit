const nodemailer = require("nodemailer");
const logger = require("../lib/logger");

/**
 * sendEmailReply — sends an email reply via nodemailer.
 *
 * SMTP credentials come from SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
 * If SMTP is not configured, the send is skipped with a warning (no throw:
 * reply dispatch must not fail the comment creation).
 */
const sendEmailReply = async ({ to, subject, body }) => {
  const host = process.env.SMTP_HOST;
  if (!host) {
    logger.warn("SMTP_HOST not set; skipping email reply", { to });
    return;
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = port === 465;
  const auth = process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
  });

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "support@example.com";

  await transporter.sendMail({
    from,
    to,
    subject,
    text: body,
  });
};

module.exports = { sendEmailReply };
