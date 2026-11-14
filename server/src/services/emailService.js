const nodemailer = require("nodemailer");
const logger = require("../lib/logger");

let transporter = null;

const smtpPort = () => {
  const port = Number(process.env.SMTP_PORT);
  return Number.isFinite(port) && port > 0 ? port : 587;
};

const smtpSecure = () => {
  const configured = process.env.SMTP_SECURE;
  if (configured !== undefined && configured !== "") {
    return String(configured).toLowerCase() === "true";
  }
  return smtpPort() === 465;
};

const isEmailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);

const getTransporter = () => {
  if (transporter) return transporter;

  const user = process.env.SMTP_USER;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort(),
    secure: smtpSecure(),
    auth: user ? { user, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
};

const safeHeaderValue = (value) => String(value ?? "").replace(/[\r\n]+/g, " ").trim();

const buildConfirmationText = ({ name, ticket, orgName }) =>
  [
    `Hello ${safeHeaderValue(name)},`,
    "",
    `Thanks for contacting ${safeHeaderValue(orgName)}. We received your request and opened ticket ${safeHeaderValue(ticket.ticketNumber)}.`,
    "",
    `Subject: ${safeHeaderValue(ticket.subject)}`,
    "Status: Open",
    "",
    "A member of our team will follow up as soon as possible.",
    "If you need to add more details, reply to this email.",
    "",
    `— ${safeHeaderValue(orgName)}`,
  ].join("\n");

/**
 * sendTicketConfirmation — delivers the customer receipt for a public form
 * submission. Returns false when SMTP is not configured so callers can keep
 * the ticket and report confirmationSent accurately. Real send failures are
 * thrown and handled (logged) by the caller.
 */
const sendTicketConfirmation = async ({ to, name, ticket, orgName }) => {
  if (!isEmailConfigured()) {
    logger.warn("SMTP is not configured; skipping ticket confirmation email", {
      ticketNumber: ticket.ticketNumber,
    });
    return false;
  }

  const fromName = safeHeaderValue(process.env.SMTP_FROM_NAME || orgName);

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM_NAME
      ? { name: fromName, address: process.env.SMTP_FROM }
      : process.env.SMTP_FROM,
    to,
    subject: `[${safeHeaderValue(ticket.ticketNumber)}] We received your request`,
    text: buildConfirmationText({ name, ticket, orgName }),
  });

  return true;
};

module.exports = {
  isEmailConfigured,
  buildConfirmationText,
  sendTicketConfirmation,
};
