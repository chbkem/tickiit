const clerkClient = require("../lib/clerk");
const ApiError = require("../utils/ApiError");

const assertUserExists = async (userId) => {
  if (!userId) return;
  try {
    await clerkClient.users.getUser(userId);
  } catch (error) {
    if (error && error.status === 404) {
      throw new ApiError(400, `Referenced user "${userId}" does not exist in Clerk.`);
    }
    throw error;
  }
};

const assertOrganizationExists = async (orgId) => {
  if (!orgId) return;
  try {
    await clerkClient.organizations.getOrganization({ organizationId: orgId });
  } catch (error) {
    if (error && error.status === 404) {
      throw new ApiError(400, `Referenced organization "${orgId}" does not exist in Clerk.`);
    }
    throw error;
  }
};

const assertUserInOrganization = async (userId, orgId) => {
  if (!userId || !orgId) return;
  const { data } = await clerkClient.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    userId: [userId],
  });
  if (!Array.isArray(data) || data.length === 0) {
    throw new ApiError(403, `User "${userId}" is not a member of organization "${orgId}".`);
  }
};

const getUserOrganizationRole = async (userId, orgId) => {
  if (!userId || !orgId) return null;
  const { data } = await clerkClient.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    userId: [userId],
  });
  const membership = Array.isArray(data) ? data[0] : undefined;
  return membership?.role ?? null;
};

const ADMIN_ROLES = new Set(["admin", "org:admin"]);

const assertUserIsAdminInOrganization = async ({ userId, orgId, sessionOrgId, sessionOrgRole }) => {
  if (!orgId) return;
  const role =
    orgId === sessionOrgId ? sessionOrgRole ?? null : await getUserOrganizationRole(userId, orgId);
  if (!ADMIN_ROLES.has(role)) {
    throw new ApiError(403, "Only admins can assign tickets.");
  }
};

module.exports = {
  assertUserExists,
  assertOrganizationExists,
  assertUserInOrganization,
  getUserOrganizationRole,
  assertUserIsAdminInOrganization,
  ADMIN_ROLES,
};