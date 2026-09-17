const { z } = require("zod");
const { tool } = require("ai");
const { STATUSES, PRIORITIES, TICKET_TYPES } = require("../../constants/ticket");

const MAX_IDENTIFIER_LENGTH = 200;
const MAX_LIMIT = 25;

const ListTicketsInput = z
  .object({
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    type: z.enum(TICKET_TYPES).optional(),
    unassigned: z.boolean().optional(),
    assigneeId: z.string().trim().min(1).max(MAX_IDENTIFIER_LENGTH).optional(),
    requesterKey: z.string().trim().min(1).max(MAX_IDENTIFIER_LENGTH).optional(),
    email: z.string().trim().min(1).max(MAX_IDENTIFIER_LENGTH).optional(),
    limit: z.number().int().min(1).max(MAX_LIMIT).optional().default(10),
  })
  .strict()
  .refine((val) => !(val.requesterKey && val.email), {
    message: "Provide 'requesterKey' or 'email', not both.",
  });

/**
 * buildListWhere — pure filter assembly for list_tickets.
 * Tickets are always scoped to the request's org (or the requester when no
 * org applies); extra filters narrow within that scope.
 */
const buildListWhere = ({ args, orgId, requesterId }) => {
  const scope = orgId ? { orgId } : { requesterId };
  const where = { ...scope };
  if (args.status) where.status = args.status;
  if (args.priority) where.priority = args.priority;
  if (args.type) where.type = args.type;
  if (args.unassigned) where.assigneeId = null;
  if (args.assigneeId) where.assigneeId = args.assigneeId;
  if (args.requesterKey) where.requesterKey = args.requesterKey;
  if (args.email) where.requesterEmail = args.email;
  return where;
};

const summarizeTicket = (ticket) => ({
  id: ticket.id,
  ticketNumber: ticket.ticketNumber,
  subject: ticket.subject,
  status: ticket.status,
  priority: ticket.priority,
  type: ticket.type,
  requesterId: ticket.requesterId,
  requesterName: ticket.requesterName,
  requesterEmail: ticket.requesterEmail,
  assigneeId: ticket.assigneeId,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
});

const listTicketsTool = ({ ctx }) =>
  tool({
    description:
      "Search tickets (read-only). Filters: status, priority, type, unassigned, assigneeId, requesterKey, email, limit (max 25). Returns ticket summaries, newest first, scoped to the current org or requester.",
    inputSchema: ListTicketsInput,
    execute: async (args) => {
      const tickets = await ctx.prisma.ticket.findMany({
        where: buildListWhere({ args, orgId: ctx.orgId, requesterId: ctx.identity.requesterId }),
        orderBy: { createdAt: "desc" },
        take: args.limit,
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
          type: true,
          requesterId: true,
          requesterName: true,
          requesterEmail: true,
          assigneeId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return { tickets: Array.isArray(tickets) ? tickets.map(summarizeTicket) : [] };
    },
  });

module.exports = { listTicketsTool, buildListWhere, ListTicketsInput, MAX_LIMIT, summarizeTicket };