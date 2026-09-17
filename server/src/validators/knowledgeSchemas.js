const { z } = require("zod");
const { sanitizeText } = require("../utils/sanitize");

const MAX_TAG_LENGTH = 50;
const MAX_TAGS = 10;
const MAX_SEARCH_LENGTH = 200;
const MIN_LIST_LIMIT = 1;
const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;

const cleanedTitle = z.preprocess(
  (val) => (val === undefined || val === null ? val : sanitizeText(val)),
  z.string().trim().min(1, "Field 'title' must be a non-empty string."),
);

const cleanedBody = z.preprocess(
  (val) => (val === undefined || val === null ? val : sanitizeText(val)),
  z.string().trim().min(1, "Field 'body' must be a non-empty string."),
);

const optionalIdentifier = z
  .string()
  .trim()
  .transform((val) => val || null)
  .optional();

const sanitizeTags = (val) => {
  if (val === undefined || val === null) return val;
  if (!Array.isArray(val)) return val;
  return val
    .map((tag) => sanitizeText(String(tag)))
    .filter(Boolean)
    .map((tag) => tag.slice(0, MAX_TAG_LENGTH))
    .slice(0, MAX_TAGS);
};

const tagsCreate = z.preprocess(
  sanitizeTags,
  z.array(z.string().min(1)).default([]),
);

const tagsUpdate = z.preprocess(sanitizeTags, z.array(z.string().min(1)).optional());

const sanitizedSource = z.preprocess(
  (val) => (val === undefined || val === null ? val : sanitizeText(val)),
  z.string().trim().min(1, "Field 'source' must be a non-empty string.").optional(),
);

const knowledgeIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Must be a valid UUID." }),
  }),
});

const createKnowledgeSchema = z.object({
  body: z
    .object({
      title: cleanedTitle,
      body: cleanedBody,
      tags: tagsCreate,
      source: sanitizedSource,
      orgId: optionalIdentifier,
    })
    .strict(),
});

const updateKnowledgeSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Must be a valid UUID." }),
  }),
  body: z
    .object({
      title: cleanedTitle.optional(),
      body: cleanedBody.optional(),
      tags: tagsUpdate,
      source: sanitizedSource,
      orgId: optionalIdentifier,
    })
    .strict()
    .refine((val) => Object.keys(val).length > 0, {
      message: "No valid update fields provided.",
    }),
});

// Non-strict: pagination/services may add more query keys without breaking the list.
const listKnowledgeSchema = z.object({
  query: z.object({
    search: z.preprocess(
      (val) => {
        if (val === undefined || val === null) return undefined;
        const cleaned = sanitizeText(val);
        return cleaned === "" ? undefined : cleaned;
      },
      z.string().min(1, "Field 'search' must be a non-empty string.").max(MAX_SEARCH_LENGTH).optional(),
    ),
    limit: z.coerce.number().int().min(MIN_LIST_LIMIT).max(MAX_LIST_LIMIT).optional(),
  }),
});

module.exports = {
  knowledgeIdParamSchema,
  createKnowledgeSchema,
  updateKnowledgeSchema,
  listKnowledgeSchema,
  DEFAULT_LIST_LIMIT,
  MAX_TAG_LENGTH,
  MAX_TAGS,
};