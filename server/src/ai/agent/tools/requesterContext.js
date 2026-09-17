const { z } = require("zod");
const { cleanedText } = require("../../contracts/triageDecision");
const { sanitizeText } = require("../../../utils/sanitize");

const MAX_IDENTIFIER_LENGTH = 200;
const MAX_FIELD_LENGTH = 200;
const MAX_RECENT_TICKETS = 5;

const RequesterContextInput = z
  .object({
    requesterRef: cleanedText(MAX_IDENTIFIER_LENGTH, "requesterRef must be a non-empty string"),
  })
  .strict();

const cleanString = (value) => {
  const cleaned = sanitizeText(value);
  return cleaned == null || cleaned === "" ? null : cleaned.slice(0, MAX_FIELD_LENGTH);
};

const cleanTicket = (ticket = {}) => ({
  id: cleanString(ticket.id),
  subject: cleanString(ticket.subject),
  status: cleanString(ticket.status),
  priority: cleanString(ticket.priority),
  type: cleanString(ticket.type),
  createdAt: ticket.createdAt ?? null,
});

/**
 * get_requester_context — resolves the requester (Clerk user) plus their recent
 * and open tickets so the agent can ground a decision in history and workload.
 *
 * The store is injected (a Clerk/prisma-backed implementation is wired by the
 * worker's enrich stage, build step 6). A missing store or an unknown requester
 * returns a harmless "no context" result — the agent proceeds without fabricating
 * data — while a lookup error surfaces as an ok:false result the loop can retry.
 */
const requesterContextTool = ({ requesterStore } = {}) => ({
  name: "get_requester_context",
  description:
    "Resolve a requester: their profile and recent ticket history, plus open-ticket count. Args: requesterRef (the requester identifier from the ticket data). Returns the requester profile, recentTickets, openTicketCount, and totalTicketCount, or requester: null when unknown.",
  kind: "read",
  inputSchema: RequesterContextInput,
  run: async (ctx, args) => {
    const orgId = ctx?.orgId ?? ctx?.task?.orgId ?? null;
    if (!requesterStore || typeof requesterStore.getRequesterContext !== "function") {
      return {
        requesterRef: args.requesterRef,
        requester: null,
        openTicketCount: 0,
        totalTicketCount: 0,
        recentTickets: [],
        note: "Requester lookup is unavailable.",
      };
    }
    const found = await requesterStore.getRequesterContext({ orgId, requesterRef: args.requesterRef });
    if (!found || !found.requester) {
      return {
        requesterRef: args.requesterRef,
        requester: null,
        openTicketCount: 0,
        totalTicketCount: 0,
        recentTickets: [],
        note: "Requester was not found; no profile or history is available.",
      };
    }
    const r = found.requester;
    const recentTickets = (Array.isArray(found.recentTickets) ? found.recentTickets : [])
      .slice(0, MAX_RECENT_TICKETS)
      .map(cleanTicket);
    return {
      requesterRef: args.requesterRef,
      requester: {
        ref: cleanString(r.ref) ?? args.requesterRef,
        name: cleanString(r.name),
        email: cleanString(r.email),
        role: cleanString(r.role),
      },
      openTicketCount: Number(found.openTicketCount ?? 0),
      totalTicketCount: Number(found.totalTicketCount ?? recentTickets.length),
      recentTickets,
    };
  },
});

module.exports = { requesterContextTool, RequesterContextInput, MAX_RECENT_TICKETS };