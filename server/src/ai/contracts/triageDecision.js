const { z } = require("zod");
const { sanitizeText } = require("../../utils/sanitize");
const { PRIORITIES, TICKET_TYPES } = require("../../constants/ticket");

const MAX_SUBJECT_LENGTH = 2000;
const MAX_TEXT_LENGTH = 2000;
const MAX_IDENTIFIER_LENGTH = 200;
const MAX_SIGNAL_LENGTH = 500;
const MAX_SIGNALS = 20;

// Field builders avoid z.preprocess: zod's z.toJSONSchema() (used to derive OpenAI
// tool schemas from tool input schemas) cannot represent preprocess effects but can
// represent string transforms piped into string/refine schemas.

// Model outputs may arrive in any casing; normalize enum fields to upper case.
// Uses zod's built-in .toUpperCase() transform (JSON-schema representable) rather
// than a custom .transform(fn), which z.toJSONSchema cannot represent.
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
    .max(max)
    .nullable()
    .transform((val) => (val == null ? null : sanitizeText(val) || null))
    .pipe(z.string().max(max).nullable())
    .default(null);

const TriageDecision = z
  .object({
    subject: cleanedText(MAX_SUBJECT_LENGTH, "subject must be a non-empty string"),
    type: uppercaseEnum(TICKET_TYPES),
    priority: uppercaseEnum(PRIORITIES),
    assigneeRef: optionalCleanedText(MAX_IDENTIFIER_LENGTH),
    rationale: cleanedText(MAX_TEXT_LENGTH, "rationale must be a non-empty string"),
  })
  .strict();

const ConfidenceLabel = z.enum(["LOW", "MEDIUM", "HIGH"]);

const Confidence = z
  .object({
    score: z.number().min(0).max(1),
    label: ConfidenceLabel.optional(),
    reasoning: optionalCleanedText(MAX_TEXT_LENGTH),
    signals: z
      .array(z.string().trim().min(1).max(MAX_SIGNAL_LENGTH))
      .max(MAX_SIGNALS)
      .optional(),
  })
  .strict();

const TriageResponse = z
  .object({
    decision: TriageDecision,
    confidence: Confidence,
  })
  .strict();

const parseTriageResponse = (value) => TriageResponse.safeParse(value);

module.exports = {
  TriageDecision,
  Confidence,
  ConfidenceLabel,
  TriageResponse,
  parseTriageResponse,
  uppercaseEnum,
  cleanedText,
  optionalCleanedText,
};