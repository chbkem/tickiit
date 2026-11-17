const { getAuth } = require("@clerk/express");

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../middleware/asyncHandler");
const logger = require("../lib/logger");
const ticketService = require("../services/ticketService");
const commentService = require("../services/commentService");
const { assertCanAccessTicket } = require("../utils/access");
const { assertUserIsAdminInOrganization } = require("../services/clerkService");

const assertTicketByParam = async (ticketId) => {
  const ticket = await ticketService.findTicketById(ticketId, { include: false });
  if (!ticket) {
    throw new ApiError(404, "Ticket not found.");
  }
  return ticket;
};

const assertCommentByParams = async (commentId, ticket) => {
  const comment = await commentService.findCommentById(commentId);
  if (!comment || comment.ticketId !== ticket.id) {
    throw new ApiError(404, "Comment not found.");
  }
  return comment;
};

const assertCanModifyComment = async ({
  comment,
  ticket,
  userId,
  orgId,
  orgRole,
  action,
}) => {
  if (comment.authorId === userId) return;
  if (ticket.orgId) {
    await assertUserIsAdminInOrganization({
      userId,
      orgId: ticket.orgId,
      sessionOrgId: orgId,
      sessionOrgRole: orgRole,
    });
    return;
  }
  throw new ApiError(403, `You cannot ${action} this comment.`);
};

exports.listComments = asyncHandler(async (req, res) => {
  const { userId, orgId } = getAuth(req);
  const ticket = await assertTicketByParam(req.params.ticketId);
  assertCanAccessTicket(ticket, { userId, orgId });

  const comments = await commentService.listComments(ticket.id);
  res.json(comments);
});

exports.createComment = asyncHandler(async (req, res) => {
  const { userId, orgId } = getAuth(req);
  const ticket = await assertTicketByParam(req.params.ticketId);
  assertCanAccessTicket(ticket, { userId, orgId });

  const comment = await commentService.createComment(ticket.id, userId, req.body.body);

  logger.info("Comment created", {
    commentId: comment.id,
    ticketId: ticket.id,
    actorId: userId,
  });

  res.status(201).json(comment);
});

exports.updateComment = asyncHandler(async (req, res) => {
  const { userId, orgId, orgRole } = getAuth(req);
  const ticket = await assertTicketByParam(req.params.ticketId);
  assertCanAccessTicket(ticket, { userId, orgId });

  const comment = await assertCommentByParams(req.params.commentId, ticket);
  await assertCanModifyComment({
    comment,
    ticket,
    userId,
    orgId,
    orgRole,
    action: "edit",
  });

  const updated = await commentService.updateComment(comment.id, req.body.body);

  logger.info("Comment updated", {
    commentId: updated.id,
    ticketId: ticket.id,
    actorId: userId,
  });

  res.json(updated);
});

exports.deleteComment = asyncHandler(async (req, res) => {
  const { userId, orgId, orgRole } = getAuth(req);
  const ticket = await assertTicketByParam(req.params.ticketId);
  assertCanAccessTicket(ticket, { userId, orgId });

  const comment = await assertCommentByParams(req.params.commentId, ticket);
  await assertCanModifyComment({
    comment,
    ticket,
    userId,
    orgId,
    orgRole,
    action: "delete",
  });

  await commentService.deleteComment(comment.id);

  logger.info("Comment deleted", {
    commentId: comment.id,
    ticketId: ticket.id,
    actorId: userId,
  });

  res.json({ message: "Comment deleted successfully.", id: comment.id });
});