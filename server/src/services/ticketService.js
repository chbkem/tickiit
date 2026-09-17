const prisma = require("../lib/prisma");
const { getNextTicketNumber } = require("../utils/ticketNumber");

const INCLUDE_COMMENTS = { comments: { orderBy: { createdAt: "asc" } } };

const listTickets = async (where) =>
  prisma.ticket.findMany({
    where,
    include: INCLUDE_COMMENTS,
    orderBy: { createdAt: "desc" },
  });

const findTicketById = (id, { include = true } = {}) =>
  prisma.ticket.findUnique({
    where: { id },
    include: include ? INCLUDE_COMMENTS : undefined,
  });

const createTicket = async ({ data }) =>
  prisma.$transaction(async (tx) => {
    const ticketNumber = await getNextTicketNumber(tx);
    return tx.ticket.create({
      data: { ...data, ticketNumber },
      include: INCLUDE_COMMENTS,
    });
  });

const applyLifecycleTimestamps = (data, existing) => {
  if (data.status && data.status !== existing.status) {
    if (data.status === "RESOLVED") data.resolvedAt = existing.resolvedAt ?? new Date();
    if (data.status === "CLOSED") data.closedAt = existing.closedAt ?? new Date();
    if (data.status !== "RESOLVED") data.resolvedAt = null;
    if (data.status !== "CLOSED") data.closedAt = null;
  }
  return data;
};

const updateTicket = (id, data) =>
  prisma.ticket.update({
    where: { id },
    data,
    include: INCLUDE_COMMENTS,
  });

const deleteTicket = (id) => prisma.ticket.delete({ where: { id } });

module.exports = {
  listTickets,
  findTicketById,
  createTicket,
  applyLifecycleTimestamps,
  updateTicket,
  deleteTicket,
};