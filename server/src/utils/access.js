const ApiError = require("./ApiError");

const assertCanAccessTicket = (ticket, { userId, orgId }) => {
  const authorized = orgId
    ? ticket.orgId === orgId
    : ticket.requesterId === userId || ticket.assigneeId === userId;
  if (!authorized) {
    throw new ApiError(403, "You do not have access to this ticket.");
  }
};

module.exports = { assertCanAccessTicket };