const { z } = require("zod");
const { sanitizeText } = require("../utils/sanitize");

const uuid = (field) => z.string().uuid({ message: `Field '${field}' must be a valid UUID.` });

const ticketIdParamSchema = z.object({
  params: z.object({
    ticketId: uuid("ticketId"),
  }),
});

const commentParamsSchema = z.object({
  params: z.object({
    ticketId: uuid("ticketId"),
    commentId: uuid("commentId"),
  }),
});

const commentText = z.preprocess(
  (val) => (val === undefined || val === null ? val : sanitizeText(val)),
  z.string().trim().min(1, "Field 'body' must be a non-empty string."),
);

const createCommentSchema = z.object({
  params: z.object({
    ticketId: uuid("ticketId"),
  }),
  body: z.object({
    body: commentText,
  }).strict(),
});

const updateCommentSchema = z.object({
  params: z.object({
    ticketId: uuid("ticketId"),
    commentId: uuid("commentId"),
  }),
  body: z.object({
    body: commentText,
  }).strict(),
});

module.exports = {
  ticketIdParamSchema,
  commentParamsSchema,
  createCommentSchema,
  updateCommentSchema,
};