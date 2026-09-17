const { z } = require("zod");
const { tool } = require("ai");

const GetTicketInput = z
  .object({
    id: z.string().uuid({ message: "Must be a valid ticket id." }),
  })
  .strict();

const summarizeComment = (comment) => ({
  id: comment.id,
  authorId: comment.authorId,
  body: comment.body,
  createdAt: comment.createdAt,
});

/**
 * get_ticket — read a single ticket (with comments). Scoped to the request's
 * org, or to the requester when no org applies. Inaccessible tickets surface
 * as a tool error the model can react to, never leaking another tenant's rows.
 */
const getTicketTool = ({ ctx }) =>
  tool({
    description:
      "Fetch a single ticket by its id, including its comments (read-only). Access is scoped to the current org or requester.",
    inputSchema: GetTicketInput,
    execute: async (args) => {
      const ticket = await ctx.prisma.ticket.findUnique({
        where: { id: args.id },
        include: { comments: { orderBy: { createdAt: "asc" } } },
      });
      if (!ticket) {
        throw new Error(`No ticket found with id "${args.id}".`);
      }
      const accessible = ctx.orgId
        ? ticket.orgId === ctx.orgId
        : ticket.requesterId === ctx.identity.requesterId;
      if (!accessible) {
        throw new Error(`No ticket found with id "${args.id}".`);
      }
      return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        type: ticket.type,
        requesterId: ticket.requesterId,
        requesterName: ticket.requesterName,
        requesterEmail: ticket.requesterEmail,
        assigneeId: ticket.assigneeId,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        comments: Array.isArray(ticket.comments) ? ticket.comments.map(summarizeComment) : [],
      };
    },
  });

module.exports = { getTicketTool, GetTicketInput };