const { z } = require("zod");
const { tool } = require("ai");
const { sanitizeText } = require("../../utils/sanitize");
const { buildName } = require("../identity");

const MAX_FIELD_LENGTH = 200;
const DEFAULT_POOL_LIMIT = 100;
const OPEN_STATUSES = Object.freeze(["OPEN", "IN_PROGRESS", "ON_HOLD"]);

const cleanString = (value) => {
  if (typeof value !== "string") return null;
  const cleaned = sanitizeText(value);
  return cleaned == null || cleaned === "" ? null : cleaned.slice(0, MAX_FIELD_LENGTH);
};

/**
 * loadAgentPool — the assignable candidacy set for an org (read-only).
 * Every org member (any role) except the requester is listed, ranked by
 * open-ticket workload (least loaded first). No assignment is ever made by
 * the triage pipeline; the pool exists so the agent can reason about who is
 * available and/or surface suggestions to the caller.
 */
const loadAgentPool = async ({ prisma, clerkClient, orgId, requesterRef }) => {
  if (!orgId || !clerkClient) return [];
  const [membershipsResponse, counts] = await Promise.all([
    clerkClient.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: DEFAULT_POOL_LIMIT,
    }),
    prisma.ticket.groupBy({
      by: ["assigneeId"],
      where: { orgId, assigneeId: { not: null }, status: { in: OPEN_STATUSES } },
      _count: { _all: true },
    }),
  ]);
  const workload = new Map(
    (Array.isArray(counts) ? counts : []).map(({ assigneeId, _count }) => [
      assigneeId,
      Number(_count?._all ?? 0),
    ]),
  );
  const memberships = Array.isArray(membershipsResponse?.data) ? membershipsResponse.data : [];
  return memberships
    .map((membership) => {
      const ref = cleanString(membership?.publicUserData?.userId);
      return {
        id: ref,
        name: cleanString(buildName(membership?.publicUserData?.firstName, membership?.publicUserData?.lastName)),
        role: cleanString(membership?.role),
        openTicketCount: Number(ref != null ? workload.get(ref) ?? 0 : 0),
      };
    })
    .filter((agent) => agent.id != null && agent.id !== requesterRef)
    .sort((a, b) => a.openTicketCount - b.openTicketCount || (a.name ?? "").localeCompare(b.name ?? ""));
};

const ListAgentsInput = z.object({}).strict();

const listAgentsTool = ({ ctx }) =>
  tool({
    description:
      "List the assignable staff members of the current organization (read-only), with their role and open-ticket workload. No one is assigned by this system.",
    inputSchema: ListAgentsInput,
    execute: async () => {
      const agents = await loadAgentPool({
        prisma: ctx.prisma,
        clerkClient: ctx.clerkClient,
        orgId: ctx.orgId,
        requesterRef: ctx.identity.requesterId,
      });
      return { agents };
    },
  });

module.exports = { listAgentsTool, loadAgentPool, ListAgentsInput, OPEN_STATUSES };