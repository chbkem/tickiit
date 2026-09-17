const { createTicketTool } = require("./createTicket");
const { listTicketsTool } = require("./listTickets");
const { getTicketTool } = require("./getTicket");
const { listAgentsTool } = require("./listAgents");

/**
 * createTools — closes over the request-bound ctx and returns the four AI SDK
 * tools the create agent may use: reads only (list_tickets, get_ticket,
 * list_agents) plus the single create_ticket write. Org/requester context is
 * always taken from ctx, never from the model.
 */
const createTools = ({ ctx }) => ({
  create_ticket: createTicketTool({ ctx }),
  list_tickets: listTicketsTool({ ctx }),
  get_ticket: getTicketTool({ ctx }),
  list_agents: listAgentsTool({ ctx }),
});

module.exports = { createTools };