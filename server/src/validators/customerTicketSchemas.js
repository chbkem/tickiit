const { z } = require("zod");
const { sanitizeText } = require("../utils/sanitize");

const uuid = (field) => z.string().uuid({ message: `Field '${field}' must be a valid UUID.` });

const tokenParamSchema = z.object({
  params: z.object({ token: z.string().min(1) }),
});

const ticketIdParamSchema = z.object({
  params: z.object({ ticketId: uuid("ticketId") }),
});

const replyText = z.preprocess(
  (value) => (value === undefined || value === null ? value : sanitizeText(value)),
  z
    .string()
    .trim()
    .min(1, "Field 'body' must be a non-empty string.")
    .max(5000, "Field 'body' must be at most 5000 characters."),
);

const createReplySchema = z.object({
  params: z.object({ token: z.string().min(1) }),
  body: z.object({ body: replyText }).strict(),
});

module.exports = { tokenParamSchema, ticketIdParamSchema, createReplySchema };
