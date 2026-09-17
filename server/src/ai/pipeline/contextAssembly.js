const { estimateTokens } = require("../agent/memory/buffer");
const { sanitizeText } = require("../../utils/sanitize");

const DEFAULT_MAX_CONTEXT_TOKENS = 4000;
const BUDGET_FACTOR = 0.6;
const MAX_BODY_TOKENS = 800;
const MAX_TICKETS_SHOWN = 5;
const MAX_AGENTS_SHOWN = 10;
const MAX_KB_SHOWN = 6;

const DEFAULT_SECTION_CAPS = Object.freeze({
  requester: 300,
  policy: 300,
  agents: 400,
  knowledge: 400,
});

const SECTION_ORDER = ["requester", "agents", "policy", "knowledge"];

const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const safeText = (value) => {
  const cleaned = sanitizeText(value);
  return cleaned == null || cleaned === "" ? null : cleaned;
};

const renderRequester = (enriched = {}) => {
  const requester = enriched.requester;
  const tickets = Array.isArray(enriched.recentTickets) ? enriched.recentTickets : [];
  if (!(requester && typeof requester === "object") && tickets.length === 0) return "";
  const lines = [];
  if (requester && typeof requester === "object") {
    if (requester.name) lines.push(`Name: ${requester.name}`);
    if (requester.email) lines.push(`Email: ${requester.email}`);
    if (requester.role) lines.push(`Role: ${requester.role}`);
    lines.push(`Open tickets: ${Number(enriched.openTicketCount ?? 0)} (total ${Number(enriched.totalTicketCount ?? 0)})`);
  }
  const forTickets = tickets.slice(0, MAX_TICKETS_SHOWN);
  for (const ticket of forTickets) {
    const status = safeText(ticket.status) ?? "";
    const priority = safeText(ticket.priority) ?? "";
    const subject = safeText(ticket.subject);
    if (!subject) continue;
    const when = toDate(ticket.createdAt);
    lines.push(`- [${status} / ${priority}] ${subject}${when ? ` (${when})` : ""}`);
  }
  return lines.length > 0 ? lines.join("\n") : "No requester context available.";
};

const renderAgents = (pool) => {
  if (pool == null) return "";
  const agents = (Array.isArray(pool) ? pool : [])
    .filter((agent) => agent && agent.ref)
    .sort(
      (a, b) => Number(a.openTicketCount ?? 0) - Number(b.openTicketCount ?? 0) || (a.name ?? "").localeCompare(b.name ?? ""),
    )
    .slice(0, MAX_AGENTS_SHOWN);
  if (agents.length === 0) return "No assignable agents in the pool.";
  return agents
    .map(
      (agent) =>
        `${safeText(agent.ref)} | ${safeText(agent.name) ?? "?"} | ${safeText(agent.role) ?? "?"} | open=${Number(agent.openTicketCount ?? 0)}`,
    )
    .join("\n");
};

const renderPolicy = (orgPolicy) => {
  if (orgPolicy == null) return "";
  const lines = [];
  if (orgPolicy.orgName) lines.push(`Organization: ${orgPolicy.orgName}`);
  const policy = orgPolicy.policy && typeof orgPolicy.policy === "object" ? orgPolicy.policy : {};
  const sla = policy.sla && typeof policy.sla === "object" ? policy.sla : {};
  if (sla.responseHours != null) lines.push(`SLA response (hours): ${sla.responseHours}`);
  if (sla.resolutionHours != null) lines.push(`SLA resolution (hours): ${sla.resolutionHours}`);
  if (policy.defaultPriority) lines.push(`Default priority: ${policy.defaultPriority}`);
  if (policy.defaultType) lines.push(`Default type: ${policy.defaultType}`);
  if (policy.notes) lines.push(`Notes: ${policy.notes}`);
  if (lines.length === 0) return "No organization policy configured.";
  return lines.join("\n");
};

const renderKnowledge = (hits) => {
  if (hits == null) return "";
  const knowledge = (Array.isArray(hits) ? hits : []).slice(0, MAX_KB_SHOWN);

  if (knowledge.length === 0) return "No knowledge base hits available.";
  return knowledge
    .map((hit) => {
      const title = safeText(hit.title) ?? "Untitled";
      const snippet = safeText(hit.snippet);
      const relevance = safeText(hit.relevance) ?? "";
      return `- [${relevance}] ${title}${snippet ? ` — ${snippet}` : ""}`;
    })
    .join("\n");
};

const RENDERERS = {
  requester: (enriched) => renderRequester(enriched),
  agents: (enriched) => renderAgents(enriched.agentPool),
  policy: (enriched) => renderPolicy(enriched.orgPolicy),
  knowledge: (enriched) => renderKnowledge(enriched.knowledge),
};

const renderBaseContext = ({ subject, body, requesterRef }) => {
  const lines = [];
  if (subject) lines.push(`Subject: ${subject}`);
  if (body) lines.push(`Body:\n${body}`);
  if (requesterRef) lines.push(`Requester reference: ${requesterRef}`);
  return lines.join("\n\n");
};

const truncateSection = (text, capTokens, remaining) => {
  const tokens = Math.min(capTokens, remaining);
  const chars = Math.max(0, tokens * 4 - 3);
  if (chars <= 0) return null;
  return `${text.slice(0, chars)}…`;
};

/**
 * buildRuntimeContext — budgeted context assembly.
 *
 * Turns the enriched pipeline payload into the runtime `context` object:
 *   - subject/body/requesterRef always travel through (body capped to a budget
 *     guardrail), then
 *   - each context section (requester+history, agent pool, org policy, KB hits)
 *     is rendered to a compact digest and filled greedily in priority order up to
 *     the total token budget (default 60% of AI_MAX_CONTEXT_TOKENS) and its
 *     per-section cap.
 * The agent pulls the *full* requester/pool/policy/KB detail on demand via the
 * read tools. allowedAssignees is propagated from the enriched pool so the
 * runtime's create_ticket stays within the closed-world candidacy set.
 *
 * Returns { context, meta }; meta records token accounting and which sections
 * were truncated or dropped, for traces/future evals.
 */
const buildRuntimeContext = ({ enriched = {}, budgetTokens, sectionCaps = DEFAULT_SECTION_CAPS } = {}) => {
  const maxContextTokens = Number(process.env.AI_MAX_CONTEXT_TOKENS ?? DEFAULT_MAX_CONTEXT_TOKENS);
  const budget = Number.isFinite(budgetTokens) ? Math.floor(budgetTokens) : Math.floor(maxContextTokens * BUDGET_FACTOR);

  const subject = safeText(enriched.subject);
  const requesterRef = safeText(enriched.requesterRef);
  let body = safeText(enriched.body) ?? "";

  let bodyTruncated = false;
  if (estimateTokens(body) > MAX_BODY_TOKENS) {
    body = `${body.slice(0, MAX_BODY_TOKENS * 4 - 3)}…`;
    bodyTruncated = true;
  }
  const base = renderBaseContext({ subject, body, requesterRef });
  const baseTokens = estimateTokens(base);
  const remaining = Math.max(0, budget - baseTokens);

  const extra = {};
  const included = [];
  const truncated = [];
  if (bodyTruncated) truncated.push("body");

  let left = remaining;
  for (const name of SECTION_ORDER) {
    const text = RENDERERS[name]?.(enriched) ?? "";
    if (text === "") continue;
    if (left <= 0) {
      truncated.push(name);
      continue;
    }
    const cap = sectionCaps[name] ?? DEFAULT_SECTION_CAPS[name];
    const tokens = estimateTokens(text);
    if (tokens <= cap && tokens <= left) {
      extra[name] = text;
      included.push(name);
      left -= tokens;
      continue;
    }
    const clipped = truncateSection(text, cap, left);
    if (clipped == null) {
      truncated.push(name);
      continue;
    }
    extra[name] = clipped;
    included.push(name);
    truncated.push(name);
    left -= estimateTokens(clipped);
  }

  const allowedAssignees = Array.isArray(enriched.agentPool)
    ? enriched.agentPool.map((agent) => agent?.ref).filter(Boolean)
    : null;

  return {
    context: {
      subject,
      body,
      requesterRef,
      orgId: enriched.orgId ?? null,
      extra,
      allowedAssignees,
    },
    meta: {
      orgId: enriched.orgId ?? null,
      budgetTokens: budget,
      baseTokens,
      estimatedTokens: baseTokens + (included.length > 0 ? estimateTokens(included.map((name) => extra[name]).join("\n")) : 0),
      included,
      truncated,
      allowedAssignees,
    },
  };
};

module.exports = {
  buildRuntimeContext,
  DEFAULT_SECTION_CAPS,
  SECTION_ORDER,
  MAX_BODY_TOKENS,
  estimateTokens,
  renderBaseContext,
  renderRequester,
  renderAgents,
  renderPolicy,
  renderKnowledge,
};