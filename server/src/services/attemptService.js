const prisma = require("../lib/prisma");
const logger = require("../lib/logger");

const COUNTED_VERDICTS = ["ACCEPTED", "QUARANTINED"];

/**
 * Every read and write the guard performs against the attempt log fails open
 * (AC-20): a logging or counter failure must never block a legitimate
 * submission, so the error is logged and a safe default is returned.
 */
const failOpen = (name, operation, fallback) => async (...args) => {
  try {
    return await operation(...args);
  } catch (error) {
    logger.error("Attempt log operation failed", {
      operation: name,
      errorMessage: error.message,
    });
    return fallback;
  }
};

const recordAttempt = failOpen(
  "recordAttempt",
  (data) => prisma.formSubmissionAttempt.create({ data }),
  null,
);

const findRecentCountedByEmail = failOpen(
  "findRecentCountedByEmail",
  ({ emailHash, since }) =>
    prisma.formSubmissionAttempt.findFirst({
      where: {
        emailHash,
        verdict: { in: COUNTED_VERDICTS },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
    }),
  null,
);

const countCountedByEmail = failOpen(
  "countCountedByEmail",
  ({ emailHash, since }) =>
    prisma.formSubmissionAttempt.count({
      where: {
        emailHash,
        verdict: { in: COUNTED_VERDICTS },
        createdAt: { gte: since },
      },
    }),
  0,
);

const countQuarantinedByIp = failOpen(
  "countQuarantinedByIp",
  ({ ipHash, since }) =>
    prisma.formSubmissionAttempt.count({
      where: {
        ipHash,
        verdict: "QUARANTINED",
        createdAt: { gte: since },
      },
    }),
  0,
);

/**
 * The same normalized body from a *different* email (AC-12). A same-email
 * repeat is already caught by the duplicate window (AC-7), so this only looks
 * at rows whose emailHash differs from the current sender.
 */
const findRecentCountedByBodyHash = failOpen(
  "findRecentCountedByBodyHash",
  ({ bodyHash, emailHash, since }) =>
    prisma.formSubmissionAttempt.findFirst({
      where: {
        bodyHash,
        verdict: { in: COUNTED_VERDICTS },
        createdAt: { gte: since },
        ...(emailHash ? { NOT: { emailHash } } : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
  null,
);

const findTicketNumber = failOpen("findTicketNumber", async (ticketId) => {
  if (!ticketId) return null;
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { ticketNumber: true },
  });
  return ticket ? ticket.ticketNumber : null;
}, null);

/** Retention: delete attempts older than the cutoff. Returns the delete count. */
const purgeOldAttempts = (before) =>
  prisma.formSubmissionAttempt.deleteMany({ where: { createdAt: { lt: before } } });

/** Retention: delete quarantined tickets older than the cutoff, keeping real work. */
const purgeOldQuarantinedTickets = (before) =>
  prisma.ticket.deleteMany({
    where: { isSpam: true, quarantinedAt: { lt: before } },
  });

module.exports = {
  COUNTED_VERDICTS,
  recordAttempt,
  findRecentCountedByEmail,
  countCountedByEmail,
  countQuarantinedByIp,
  findRecentCountedByBodyHash,
  findTicketNumber,
  purgeOldAttempts,
  purgeOldQuarantinedTickets,
};
