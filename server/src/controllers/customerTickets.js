const { getAuth } = require("@clerk/express");

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../middleware/asyncHandler");
const logger = require("../lib/logger");
const ticketService = require("../services/ticketService");
const customerTicketService = require("../services/customerTicketService");
const { assertCanRevokeCustomerLinks } = require("../utils/access");

// One fixed response for malformed, expired and revoked links.
const INVALID_LINK_MESSAGE = "This link is invalid or has expired.";

exports.getCustomerTicket = asyncHandler(async (req, res) => {
  const ticket = await customerTicketService.getCustomerTicket(req.params.token);
  if (!ticket) throw new ApiError(404, INVALID_LINK_MESSAGE);
  res.json(ticket);
});

exports.postCustomerReply = asyncHandler(async (req, res) => {
  const comment = await customerTicketService.createCustomerReply(req.params.token, req.body.body);
  if (!comment) throw new ApiError(404, INVALID_LINK_MESSAGE);

  logger.info("Customer reply created", {
    commentId: comment.id,
    ticketId: comment.ticketId,
  });
  res.status(201).json(comment);
});

exports.revokeCustomerLinks = asyncHandler(async (req, res) => {
  const { userId, orgId, orgRole } = getAuth(req);
  const ticket = await ticketService.findTicketById(req.params.ticketId, { include: false });
  if (!ticket) throw new ApiError(404, "Ticket not found.");
  await assertCanRevokeCustomerLinks(ticket, { userId, orgId, orgRole });

  const revokedCount = await customerTicketService.revokeCustomerLinks(ticket.id);
  logger.info("Customer links revoked", {
    ticketId: ticket.id,
    actorId: userId,
    revokedCount,
  });
  res.json({ revokedCount });
});
