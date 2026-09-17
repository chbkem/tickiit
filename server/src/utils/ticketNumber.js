const prisma = require("../lib/prisma");

const TICKET_NUMBER_LOCK_ID = 726309;
const TICKET_NUMBER_PREFIX = "#";
const TICKET_NUMBER_WIDTH = 4;

const getNextTicketNumber = async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TICKET_NUMBER_LOCK_ID})`;

  const rows = await tx.$queryRaw`
    SELECT COALESCE(
      MAX(CAST(SUBSTRING("ticketNumber", 2) AS INTEGER)),
      0
    )::int AS "maxNumber"
    FROM "Ticket"
    WHERE "ticketNumber" ~ '^#[0-9]+$'
  `;

  const nextNumber = Number(rows[0]?.maxNumber || 0) + 1;
  const digits = String(nextNumber).padStart(TICKET_NUMBER_WIDTH, "0");
  return `${TICKET_NUMBER_PREFIX}${digits}`;
};

module.exports = { getNextTicketNumber };