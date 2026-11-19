const ApiError = require("./ApiError");
const { assertUserIsAdminInOrganization } = require("../services/clerkService");

const assertCanAccessTicket = (ticket, { userId, orgId }) => {
  const authorized = orgId
    ? ticket.orgId === orgId
    : ticket.requesterId === userId || ticket.assigneeId === userId;
  if (!authorized) {
    throw new ApiError(403, "You do not have access to this ticket.");
  }
};

const assertCanRevokeCustomerLinks = async (
  ticket,
  { userId, orgId, orgRole },
  { clerk = { assertUserIsAdminInOrganization } } = {},
) => {
  assertCanAccessTicket(ticket, { userId, orgId });
  if (ticket.assigneeId === userId) return;
  if (!ticket.orgId) {
    throw new ApiError(403, "Only the assignee can revoke customer links.");
  }
  await clerk.assertUserIsAdminInOrganization({
    userId,
    orgId: ticket.orgId,
    sessionOrgId: orgId,
    sessionOrgRole: orgRole,
    message: "Only an admin or the assignee can revoke customer links.",
  });
};

module.exports = { assertCanAccessTicket, assertCanRevokeCustomerLinks };