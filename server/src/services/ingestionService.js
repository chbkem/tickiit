const prisma = require("../lib/prisma");

/**
 * recordIngestion — dedup guard for webhook deliveries.
 *
 * Attempts to create an IngestionEvent. If a record with the same
 * (channel, externalId) already exists, returns null (duplicate).
 * Otherwise returns the created event.
 */
const recordIngestion = async ({ channel, externalId, ticketId = null }) => {
  try {
    return await prisma.ingestionEvent.create({
      data: { channel, externalId: String(externalId), ticketId },
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
