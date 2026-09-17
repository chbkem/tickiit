const { getAuth } = require("@clerk/express");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("./asyncHandler");
const { ADMIN_ROLES } = require("../services/clerkService");

/**
 * requireOrgAdmin — admin gate for the /api/ai/admin router.
 *
 * Stricter than assertUserIsAdminInOrganization: it requires an active session
 * organization AND an org-admin role on the session claims (no cross-org Clerk
 * lookups). Rejects with 403 when the user has no active org, mirroring the
 * "tickets can only be created in your active organization" convention — the AI
 * knowledge base is scoped to an org, so global curation is out of scope here.
 * Sets req.orgId / req.orgRole for downstream handlers.
 */
const requireOrgAdmin = asyncHandler(async (req, res, next) => {
  const { userId, orgId, orgRole } = getAuth(req);
  if (!userId || !orgId || !ADMIN_ROLES.has(orgRole)) {
    throw new ApiError(403, "Organization admin role required.");
  }
  req.orgId = orgId;
  req.orgRole = orgRole;
  next();
});

module.exports = requireOrgAdmin;