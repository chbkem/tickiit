const { z } = require("zod");
const { sanitizeText } = require("../../utils/sanitize");
const { PRIORITIES, TICKET_TYPES } = require("../../constants/ticket");

const MAX_SUBJECT_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 8000;
const MAX_RATIONALE_LENGTH = 1000;
const MAX_REPLY_LENGTH = 2000;

// Model outputs may arrive in any casing; normalize enum fields to upper case.
// The .toUpperCase() transform is JSON-schema representable (zod v4), so the
// schema stays usable for both AI SDK tool inputSchema and Output.object,
// while client-side validation still normalizes whatever the model emits.
const uppercaseEnum = (values) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => values.includes(val), { message: `must be one of: ${values.join(", ")}` });

const cleanedText = (max, message) =>
  z
    .string()
    .transform((val) => sanitizeText(val))
    .pipe(z.string().min(1, message).max(max));

const optionalCleanedText = (max) =>
  z
    .string()
    .transform((val) => sanitizeText(val) || null)
    .pipe(z.string().max(max).nullable())
    .default(null);

const optionalField = (max) =>
  z
    .string()
    .trim()
    .transform((val) => val || null)
    .pipe(z.string().max(max).nullable())
    .default(null);

/**
 * ClassifiedTicket — clean, validated output of the classifier agent.
 * Defaults: subject from the normalized message, type TASK.
 */
const ClassifiedTicket = z
  .object({
    subject: cleanedText(MAX_SUBJECT_LENGTH, "subject must be a non-empty string"),
    description: optionalCleanedText(MAX_DESCRIPTION_LENGTH),
    type: uppercaseEnum(TICKET_TYPES),
    rationale: optionalField(MAX_RATIONALE_LENGTH),
  })
  .strict();

/**
 * PriorityDecision — output of the prioritizer agent. Default: MEDIUM.
 */
const PriorityDecision = z
  .object({
    priority: uppercaseEnum(PRIORITIES),
    rationale: optionalField(MAX_RATIONALE_LENGTH),
  })
  .strict();

/**
 * TicketDraft — the closed-world payload of the create_ticket tool.
 * Strict so a hijacked model cannot slip status/delete/whitelist-breakers in.
 */
const TicketDraft = z
  .object({
    subject: cleanedText(MAX_SUBJECT_LENGTH, "subject must be a non-empty string"),
    description: optionalCleanedText(MAX_DESCRIPTION_LENGTH),
    type: uppercaseEnum(TICKET_TYPES),
    priority: uppercaseEnum(PRIORITIES),
  })
  .strict();

/**
 * ReplyDraft — the optional customer-facing reply, returned to the caller
 * only. Never persisted.
 */
const ReplyDraft = z
  .object({
    reply: cleanedText(MAX_REPLY_LENGTH, "reply must be a non-empty string"),
  })
  .strict();

module.exports = {
  ClassifiedTicket,
  PriorityDecision,
  TicketDraft,
  ReplyDraft,
  uppercaseEnum,
  cleanedText,
  optionalCleanedText,
  MAX_SUBJECT_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_RATIONALE_LENGTH,
  MAX_REPLY_LENGTH,
};