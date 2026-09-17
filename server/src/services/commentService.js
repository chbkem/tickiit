const prisma = require("../lib/prisma");

const listComments = (ticketId) =>
  prisma.comment.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
  });

const findCommentById = (id) => prisma.comment.findUnique({ where: { id } });

const createComment = (ticketId, authorId, body) =>
  prisma.comment.create({
    data: { ticketId, authorId, body },
  });

const updateComment = (id, body) =>
  prisma.comment.update({
    where: { id },
    data: { body },
  });

const deleteComment = (id) => prisma.comment.delete({ where: { id } });

module.exports = {
  listComments,
  findCommentById,
  createComment,
  updateComment,
  deleteComment,
};