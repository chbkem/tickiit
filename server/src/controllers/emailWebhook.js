const asyncHandler = require("../middleware/asyncHandler");
const channelService = require("../services/channelService");
const ingestionService = require("../services/ingestionService");
const ticketService = require("../services/ticketService");
const { runTriage } = require("../ai/pipeline/runTriage");

/**
 * handleEmailWebhook — handles inbound email forwarded by the local SMTP server.
 *
 * The recipient support address (`to`) identifies the channel and its org. The
 * email is plain text only (AC-10): subject and body are passed straight to the
 * triage pipeline. The sender's address is stored as channelRecipient so agent
 * replies are dispatched back to the customer (AC-4).
 */
exports.handleEmailWebhook = asyncHandler(async (req, res) => {
  const { from, subject, body, messageId, to } = req.body;

  const channel = await channelService.findChannelByIdentifier("EMAIL", to);
  if (!channel) {
    return res.json({ ok: true });
  }

  const existing = await ingestionService.recordIngestion({
    channel: "EMAIL",
    externalId: messageId,
  });
  if (!existing) {
    return res.json({ ok: true });
  }

  const result = await runTriage({
    input: {
      raw: { subject, body },
      channel: "EMAIL",
      requesterRef: from,
      email: from,
      orgId: channel.orgId,
    },
  });

  // Store the reply-to address so agent replies reach the customer's inbox.
  await ticketService.updateTicket(result.ticket.id, { channelRecipient: from });

  await ingestionService.markIngestionWithTicket(existing.id, result.ticket.id);

  res.json({ ok: true, ticketId: result.ticket.id });
});
