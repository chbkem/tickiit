const { z } = require("zod");
const { sanitizeText } = require("../utils/sanitize");
const { STATUSES, PRIORITIES, TICKET_TYPES } = require("../constants/ticket");

const enumField = (values, defaultValue) =>
  z
    .preprocess(
      (val) => (val === undefined || val === null ? val : String(val).toUpperCase()),
      z.enum(values).default(defaultValue),
    );

const optionalEnumField = (values) =>
  z.preprocess(
    (val) => (val === undefined || val === null ? val : String(val).toUpperCase()),
    z.enum(values).optional(),
  );

const optionalText = z
  .preprocess(
    (val) => (val === undefined || val === null ? val : sanitizeText(val)),
    z.string().trim().min(1, "must be a non-empty string").optional(),
  );

const optionalIdentifier = z
  .string()
  .trim()
  .transform((val) => val || null)
  .optional();

const optionalDescription = z
  .preprocess(
    (val) => {
      if (typeof val === "string") {
        const cleaned = sanitizeText(val);
        return cleaned === "" ? null : cleaned;
      }
      return val;
    },
    z.string().trim().min(1, "must be a non-empty string").nullable(),
  )
  .optional();

const optionalDate = z.preprocess(
  (val) => {
    if (val === undefined) return undefined;
    if (val === null || val === "") return null;
    const date = new Date(val);
    if (Number.isNaN(date.getTime())) return val;
    return date;
  },
  z.date().nullable().optional(),
);

const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Must be a valid UUID." }),
  }),
});

const createTicketSchema = z.object({
  body: z
    .object({
      subject: z.preprocess(
        (val) => (val === undefined || val === null ? val : sanitizeText(val)),
        z.string().trim().min(1, "Field 'subject' must be a non-empty string."),
      ),
      description: optionalDescription,
      status: enumField(STATUSES, "OPEN"),
      priority: enumField(PRIORITIES, "MEDIUM"),
      type: enumField(TICKET_TYPES, "TASK"),
      source: optionalText.default("API"),
      requesterId: optionalIdentifier,
      assigneeId: optionalIdentifier,
      orgId: optionalIdentifier,
      dueAt: optionalDate,
    })
    .strict(),
});

const updateTicketSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Must be a valid UUID." }),
  }),
  body: z
    .object({
      subject: z.preprocess(
        (val) => (val === undefined || val === null ? val : sanitizeText(val)),
        z.string().trim().min(1, "Field 'subject' must be a non-empty string.").optional(),
      ),
      description: optionalDescription,
      status: optionalEnumField(STATUSES),
      priority: optionalEnumField(PRIORITIES),
      type: optionalEnumField(TICKET_TYPES),
      source: optionalText,
      requesterId: z.string().trim().min(1, "must be a non-empty string").optional(),
      assigneeId: optionalIdentifier,
      orgId: optionalIdentifier,
      dueAt: optionalDate,
    })
    .strict()
    .refine((val) => Object.keys(val).length > 0, {
      message: "No valid update fields provided.",
    }),
});

module.exports = {
  idParamSchema,
  createTicketSchema,
  updateTicketSchema,
};