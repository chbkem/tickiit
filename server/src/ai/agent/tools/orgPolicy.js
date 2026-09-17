const { z } = require("zod");
const { sanitizeText } = require("../../../utils/sanitize");

const MAX_FIELD_LENGTH = 200;
const MAX_POLICY_DEPTH = 3;

const OrgPolicyInput = z.object({}).strict();

// Sanitize recursively (bounded depth) so a policy row — which may travel to the
// model — can never carry markup or unescaped payloads into prompt context.
const cleanObject = (value, depth = 0) => {
  if (depth > MAX_POLICY_DEPTH) return undefined;
  if (typeof value === "string") return (sanitizeText(value) ?? "").slice(0, MAX_FIELD_LENGTH);
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => cleanObject(item, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = cleanObject(item, depth + 1);
    return out;
  }
  return value;
};

const defaultOrgPolicy = () => ({
  orgId: null,
  orgName: "Default policy",
  source: "default",
  policy: {
    sla: { responseHours: null, resolutionHours: null },
    defaultPriority: "MEDIUM",
    defaultType: "REQUEST",
    notes: "No organization policy is configured for this org.",
  },
});

/**
 * get_org_policy — org SLA/config targets.
 *
 * Organizations live in Clerk (no policy table in phase 1), so the provider is
 * an injected orgPolicyService; when none is wired the tool returns the
 * deterministic default policy above so the loop still has targets to reason
 * about and never hard-fails. Org is bound from context, not model arguments.
 */
const orgPolicyTool = ({ orgPolicyService } = {}) => ({
  name: "get_org_policy",
  description:
    "Get this organization's triage policy: SLA targets, default priority/type, and any routing notes. Takes no arguments; the org comes from the ticket context.",
  kind: "read",
  inputSchema: OrgPolicyInput,
  run: async (ctx, _args) => {
    const orgId = ctx?.orgId ?? ctx?.task?.orgId ?? null;
    if (!orgPolicyService || typeof orgPolicyService.getOrgPolicy !== "function") {
      return defaultOrgPolicy();
    }
    const raw = await orgPolicyService.getOrgPolicy({ orgId });
    return {
      orgId,
      orgName: (sanitizeText(raw?.orgName) ?? null)?.slice(0, MAX_FIELD_LENGTH) ?? null,
      source: raw?.source ?? "service",
      policy: cleanObject(raw?.policy ?? {}),
    };
  },
});

module.exports = { orgPolicyTool, OrgPolicyInput, defaultOrgPolicy };