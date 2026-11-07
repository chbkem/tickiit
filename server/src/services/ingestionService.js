const prisma = require("../lib/prisma");

/**
 * recordIngestion — dedup guard for webhook deliveries.
 *
 * Attempts to create an IngestionEvent. If a record with the same
 * (channelId, externalId) already exists, returns null (duplicate).
 * Otherwise returns the created event.
 *
 * Spec 0003: the pair is (channelId, externalId), not (channel, externalId).
 * Telegram numbers messages per chat, so two bots in two organizations both
 * hand you a message_id of 5; the old key silently dropped the second one.
 * channelId is nullable only so the phase 1 backfill has somewhere to write
 * from; every new row sets it.
 */
const recordIngestion = async ({ channel, externalId, channelId = null, ticketId = null }) => {
  try {
    return await prisma.ingestionEvent.create({
      data: { channel, externalId: String(externalId), channelId, ticketId },
    });
  } catch (error) {
    if (error && error.code === "P2002") {
      return null;
    }
    throw error;
  }
};

const markIngestionWithTicket = (id, ticketId) =>
  prisma.ingestionEvent.update({
    where: { id },
    data: { ticketId },
  });

module.exports = {
  recordIngestion,
  markIngestionWithTicket,
};