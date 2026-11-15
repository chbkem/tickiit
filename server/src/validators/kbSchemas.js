const { z } = require("zod");
const { sanitizeText } = require("../utils/sanitize");

const KNOWLEDGE_SOURCES = Object.freeze(["ARTICLE", "FILE", "URL", "VIDEO"]);
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

const sanitizeInput = (value) =>
  value === undefined || value === null ? value : sanitizeText(value);

const sourceField = (defaultValue) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return value;
    return String(value).trim().toUpperCase();
  }, z.enum(KNOWLEDGE_SOURCES).default(defaultValue));

const optionalSourceField = () =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return value;
    return String(value).trim().toUpperCase();
  }, z.enum(KNOWLEDGE_SOURCES).optional());

const titleField = (optional = false) => {
  const schema = z
    .string()
    .trim()
    .min(1, "Field 'title' must be a non-empty string.")
    .max(300, "Field 'title' must be 300 characters or fewer.");
  return z.preprocess(sanitizeInput, optional ? schema.optional() : schema);
};

const bodyField = (optional = false) => {
  const schema = z.string().min(1, "Field 'body' must be a non-empty string.");
  return z.preprocess(sanitizeInput, optional ? schema.optional() : schema);
};

const optionalSourceUrlField = () =>
  z.preprocess(
    (value) => (value === "" ? null : sanitizeInput(value)),
    z
      .string()
      .trim()
      .max(2048, "Field 'sourceUrl' must be 2048 characters or fewer.")
      .url("Field 'sourceUrl' must be a valid URL.")
      .nullable()
      .optional(),
  );

const tagField = z.preprocess(
  sanitizeInput,
  z
    .string()
    .trim()
    .min(1, "Tags must be non-empty strings.")
    .max(MAX_TAG_LENGTH, `Tags must be ${MAX_TAG_LENGTH} characters or fewer.`),
);

const tagsField = (optional = false) => {
  let schema = z.array(tagField).max(MAX_TAGS, `Provide ${MAX_TAGS} tags or fewer.`);
  if (optional) {
    schema = schema.optional();
  } else {
    schema = schema.default([]);
  }
  return schema.transform((tags) => (tags ? [...new Set(tags)] : tags));
};

const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Must be a valid UUID." }),
  }),
});

const createArticleSchema = z.object({
  body: z
    .object({
      title: titleField(),
      body: bodyField(),
      source: sourceField("ARTICLE"),
      sourceUrl: optionalSourceUrlField(),
      tags: tagsField(),
    })
    .strict(),
});

const updateArticleSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Must be a valid UUID." }),
  }),
  body: z
    .object({
      title: titleField(true),
      body: bodyField(true),
      source: optionalSourceField(),
      sourceUrl: optionalSourceUrlField(),
      tags: tagsField(true),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: "No valid update fields provided.",
    }),
});

module.exports = {
  KNOWLEDGE_SOURCES,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  idParamSchema,
  createArticleSchema,
  updateArticleSchema,
};
