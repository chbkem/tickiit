const { tool } = require("ai");
const { TicketDraft } = require("../contracts/triageOutput");

/**
 * create_ticket — the single write tool. Persists a ticket immediately
 * (via the bound ctx.createTicket), never assigns, and returns the created
 * record. Org/requester context comes from the request, never from the model.
 */
const createTicketTool = ({ ctx }) =>
  tool({
    description:
      "Create and persist a ticket. Args: subject (short, specific summary), description (optional longer context), type (TASK|BUG|INCIDENT|REQUEST), priority (LOW|MEDIUM|HIGH|URGENT). The ticket is created immediately and its id and number are returned. Call it exactly once.",
    inputSchema: TicketDraft,
    execute: async (args) => {
      const ticket = await ctx.createTicket({
        subject: args.subject,
        description: args.description ?? null,
        type: args.type,
        priority: args.priority,
      });
      return {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        status: ticket.status,
        type: ticket.type,
        priority: ticket.priority,
      };
    },
  });

module.exports = { createTicketTool };