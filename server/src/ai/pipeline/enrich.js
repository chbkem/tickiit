const { sanitizeText } = require("../../utils/sanitize");

const MAX_FIELD_LENGTH = 200;
const MAX_RECENT_TICKETS = 5;
const MAX_KB_HITS = 6;
const MAX_KB_QUERY_LENGTH = 500;
const MAX_POLICY_DEPTH = 3;
const OPEN_STATUSES = Object.freeze(["OPEN", "IN_PROGRESS", "ON_HOLD"]);
const DEFAULT_POOL_LIMIT = 100;

const cleanString = (value) => {
  if (typeof value !== "string") return null;
  const cleaned = sanitizeText(value);
  return cleaned == null || cleaned === "" ? null : cleaned.slice(0, MAX_FIELD_LENGTH);
};

const cleanObject = (value, depth = 0) => {
  if (depth > MAX_POLICY_DEPTH) return undefined;
  if (typeof value === "string") return (sanitizeText(value) ?? "").slice(0, MAX_FIELD_LENGTH);
  if (Array.isArray(value)) return value.map((item) => cleanObject(item, depth + 1));
  if (value != null && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = cleanObject(item, depth + 1);
    return out;
  }
  return value;
};

const buildName = (firstName, lastName) => [firstName, lastName].filter(Boolean).join(" ").trim();

const isClerkUserId = (ref) => typeof ref === "string" && ref.startsWith("user_");

/**
 * resolveUserByRef — maps a channel requesterRef to a Clerk User.
 *
 * `user_*` refs are treated as Clerk user ids (fast path); anything else is
 * resolved via the user's Clerk externalId (the canonical link for webhook /
 * channel adapters). 404s resolve to null so the pipeline can proceed without
 * fabricating an identity.
 */
const resolveUserByRef = async ({ clerkClient, requesterRef }) => {
  if (!requesterRef || !clerkClient) return null;
  if (isClerkUserId(requesterRef)) {
    try {
      return await clerkClient.users.getUser(requesterRef);
    } catch (error) {
      if (error && error.status === 404) return null;
      throw error;
    }
  }
  const { data } = await clerkClient.users.getUserList({ externalId: [requesterRef], limit: 1 });
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
};

const userToProfile = (user) => {
  if (!user) return null;
  const email = Array.isArray(user.emailAddresses) ? user.emailAddresses[0]?.emailAddress : undefined;
  return {
    ref: cleanString(user.id),
    name: cleanString(buildName(user.firstName, user.lastName)),
    email: cleanString(email),
    role: null,
  };
};

const cleanTicket = (ticket = {}) => ({
  id: cleanString(ticket.id),
  subject: cleanString(ticket.subject),
  status: cleanString(ticket.status),
  priority: cleanString(ticket.priority),
  type: cleanString(ticket.type),
  createdAt: ticket.createdAt ?? null,
});

const orgScopeOf = (orgId) => (orgId ? { orgId } : { orgId: null });

/**
 * loadRequesterContext — profile + recent tickets + open/total counts for the
 * requester. Shared by both the pipeline (context assembly) and the
 * get_requester_context tool via ClerkRequesterStore. Unknown requesters yield
 * a harmless empty result rather than throwing, so the agent proceeds without
 * fabricated data.
 */
const loadRequesterContext = async ({ prisma, clerkClient, orgId, requesterRef }) => {
  const user = await resolveUserByRef({ clerkClient, requesterRef });
  if (!user) {
    return { requester: null, openTicketCount: 0, totalTicketCount: 0, recentTickets: [] };
  }
  const scope = orgScopeOf(orgId);
  const [openTicketCount, totalTicketCount, recentTickets] = await Promise.all([
    prisma.ticket.count({ where: { requesterId: user.id, ...scope, status: { in: OPEN_STATUSES } } }),
    prisma.ticket.count({ where: { requesterId: user.id, ...scope } }),
    prisma.ticket.findMany({
      where: { requesterId: user.id, ...scope },
      orderBy: { createdAt: "desc" },
      take: MAX_RECENT_TICKETS,
    }),
  ]);
  return {
    requester: userToProfile(user),
    openTicketCount,
    totalTicketCount,
    recentTickets: (Array.isArray(recentTickets) ? recentTickets : []).map(cleanTicket),
  };
};

/**
 * loadAgentPool — the closed-world assignable candidacy set.
 *
 * Every org member (any role) except the requester is assignable, ranked by
 * open-ticket workload (least loaded first) as the agent tool contract
 * expects. Without an org there is nothing assignable (personal tickets route
 * to the requester). Workload comes from a single groupBy so it cannot diverge
 * between the pipeline and the tool.
 */
const loadAgentPool = async ({ prisma, clerkClient, orgId, requesterRef }) => {
  if (!orgId || !clerkClient) return [];
  const [membershipsResponse, requester, counts] = await Promise.all([
    clerkClient.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: DEFAULT_POOL_LIMIT,
    }),
    resolveUserByRef({ clerkClient, requesterRef }),
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
  const excluded = new Set([requester?.id, requesterRef].filter(Boolean));
  const memberships = Array.isArray(membershipsResponse?.data) ? membershipsResponse.data : [];
  return memberships
    .map((membership) => {
      const ref = cleanString(membership?.publicUserData?.userId);
      return {
        ref,
        name: cleanString(buildName(membership?.publicUserData?.firstName, membership?.publicUserData?.lastName)),
        role: cleanString(membership?.role),
        openTicketCount: Number(ref != null ? workload.get(ref) ?? 0 : 0),
      };
    })
    .filter((agent) => agent.ref != null && !excluded.has(agent.ref))
    .sort(
      (a, b) => a.openTicketCount - b.openTicketCount || (a.name ?? "").localeCompare(b.name ?? ""),
    );
};

const defaultOrgPolicy = (orgId) => ({
  orgId,
  orgName: null,
  source: "default",
  policy: {
    sla: { responseHours: null, resolutionHours: null },
    defaultPriority: "MEDIUM",
    defaultType: "REQUEST",
    notes: "No organization policy is configured for this org.",
  },
});

/**
 * loadOrgPolicy — org SLA/config targets used by context assembly and the
 * get_org_policy tool. Phase 1 reads `publicMetadata.triagePolicy` from the
 * Clerk organization when available; otherwise a deterministic default keeps
 * the agent reasoning about targets rather than hard-failing.
 */
const loadOrgPolicy = async ({ clerkClient, orgId }) => {
  if (!orgId || !clerkClient) return defaultOrgPolicy(orgId ?? null);
  try {
    const org = await clerkClient.organizations.getOrganization({ organizationId: orgId });
    if (!org) return defaultOrgPolicy(orgId);
    const configured = cleanObject(org.publicMetadata?.triagePolicy ?? {});
    return {
      orgId,
      orgName: cleanString(org.name),
      source: "clerk",
      policy: {
        sla: {
          responseHours: configured?.sla?.responseHours ?? null,
          resolutionHours: configured?.sla?.resolutionHours ?? null,
        },
        defaultPriority: configured?.defaultPriority ?? "MEDIUM",
        defaultType: configured?.defaultType ?? "REQUEST",
        notes: configured?.notes ?? "No organization policy is configured for this org.",
      },
    };
  } catch {
    return defaultOrgPolicy(orgId);
  }
};

const loadKnowledgeHits = async ({ knowledgeRetriever, orgId, subject, body }) => {
  if (!knowledgeRetriever || typeof knowledgeRetriever.search !== "function") return [];
  const query = [subject, body].filter(Boolean).join(" ").slice(0, MAX_KB_QUERY_LENGTH).trim();
  if (!query) return [];
  const result = await knowledgeRetriever.search({ orgId, query, limit: MAX_KB_HITS });
  return Array.isArray(result?.hits) ? result.hits : [];
};

/**
 * enrich — assembles the contextAssembly-fixture-shaped payload for the
 * pipeline. Everything the agent needs is resolved here once (requester +
 * history, agent pool, org policy, KB hits) so the runtime's read tools can
 * serve the same data on demand through the injected stores below.
 */
const enrich = ({ normalized, deps }) => {
  const { prisma, clerkClient, knowledgeRetriever } = deps;
  const { subject, body, requesterRef, orgId } = normalized;
  return Promise.all([
    loadRequesterContext({ prisma, clerkClient, orgId, requesterRef }),
    loadAgentPool({ prisma, clerkClient, orgId, requesterRef }),
    loadOrgPolicy({ clerkClient, orgId }),
    loadKnowledgeHits({ knowledgeRetriever, orgId, subject, body }),
  ]).then(([requesterContext, agentPool, orgPolicy, knowledge]) => ({
    ...normalized,
    requester: requesterContext.requester,
    openTicketCount: requesterContext.openTicketCount,
    totalTicketCount: requesterContext.totalTicketCount,
    recentTickets: requesterContext.recentTickets,
    agentPool,
    orgPolicy,
    knowledge,
  }));
};

const createClerkRequesterStore = ({ prisma, clerkClient }) => ({
  getRequesterContext: ({ orgId, requesterRef }) => loadRequesterContext({ prisma, clerkClient, orgId, requesterRef }),
});

const createClerkAgentPoolService = ({ prisma, clerkClient }) => ({
  listAssignableAgents: ({ orgId, requesterRef }) => loadAgentPool({ prisma, clerkClient, orgId, requesterRef }),
});

const createOrgPolicyService = ({ clerkClient }) => ({
  getOrgPolicy: ({ orgId }) => loadOrgPolicy({ clerkClient, orgId }),
});

module.exports = {
  enrich,
  resolveUserByRef,
  userToProfile,
  loadRequesterContext,
  loadAgentPool,
  loadOrgPolicy,
  loadKnowledgeHits,
  createClerkRequesterStore,
  createClerkAgentPoolService,
  createOrgPolicyService,
  defaultOrgPolicy,
  OPEN_STATUSES,
  MAX_RECENT_TICKETS,
};