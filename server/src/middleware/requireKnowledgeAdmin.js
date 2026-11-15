const { getAuth } = require("@clerk/express");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("./asyncHandler");
const { assertUserIsAdminInOrganization } = require("../services/clerkService");

const assertKnowledgeAdmin = async ({ userId, orgId, orgRole } = {}) => {
  if (!orgId) {
    throw new ApiError(403, "Select an active organization before managing knowledge.");
  }
  await assertUserIsAdminInOrganization({
    userId,
    orgId,
    sessionOrgId: orgId,
    sessionOrgRole: orgRole,
  });
  return { userId, orgId };
};

const requireKnowledgeAdmin = asyncHandler(async (req, res, next) => {
  const { userId, orgId, orgRole } = getAuth(req);
  req.knowledgeAdmin = await assertKnowledgeAdmin({ userId, orgId, orgRole });
  next();
});

module.exports = {
  assertKnowledgeAdmin,
  requireKnowledgeAdmin,
};
