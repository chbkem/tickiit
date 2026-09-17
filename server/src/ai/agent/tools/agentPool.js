const { z } = require("zod");
const { sanitizeText } = require("../../../utils/sanitize");

const MAX_FIELD_LENGTH = 200;
const MAX_AGENTS_SHOWN = 20;

const AgentPoolInput = z.object({}).strict();

const cleanAgent = (agent = {}) => ({
  ref: sanitizeText(agent.ref) ?? null,
  name: (sanitizeText(agent.name) ?? "").slice(0, MAX_FIELD_LENGTH),
  role: sanitizeText(agent.role) ?? null,
  openTicketCount: Number(agent.openTicketCount ?? 0),
});

/**
 * list_assignable_agents — the closed-world candidacy pool for create_ticket.
 *
 * The service is injected (a Clerk-org-roles + ticket-workload implementation is
 * wired by the worker's enrich stage, build step 6). The org and requester are
 * bound from the run context, never from model arguments. When a pool is
 * returned it also updates ctx.allowedAssignees so create_ticket enforces it;
 * when the service is unwired the tool reports an empty note and leaves the
 * existing pool untouched.
 */
const agentPoolTool = ({ agentPoolService } = {}) => ({
  name: "list_assignable_agents",
  description:
    "List agents assignable to this ticket, sorted by open-ticket workload (least loaded first). Takes no arguments; org and requester come from the ticket context. Returns agents with ref, name, role, and openTicketCount, plus assignableRefs.",
  kind: "read",
  inputSchema: AgentPoolInput,
  run: async (ctx, _args) => {
    const orgId = ctx?.orgId ?? ctx?.task?.orgId ?? null;
    const requesterRef = ctx?.task?.requesterRef ?? null;
    if (!agentPoolService || typeof agentPoolService.listAssignableAgents !== "function") {
      return { orgId, agents: [], assignableRefs: [], totalAgents: 0, note: "Agent pool is unavailable." };
    }
    const rawAgents = await agentPoolService.listAssignableAgents({ orgId, requesterRef });
    const agents = (Array.isArray(rawAgents) ? rawAgents : [])
      .map(cleanAgent)
      .filter((agent) => agent.ref != null)
      .sort((a, b) => a.openTicketCount - b.openTicketCount || (a.name ?? "").localeCompare(b.name ?? ""))
      .slice(0, MAX_AGENTS_SHOWN);
    const assignableRefs = agents.map((agent) => agent.ref);
    if (ctx && typeof ctx === "object") ctx.allowedAssignees = assignableRefs;
    return { orgId, agents, assignableRefs, totalAgents: agents.length };
  },
});

module.exports = { agentPoolTool, AgentPoolInput, MAX_AGENTS_SHOWN };