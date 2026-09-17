const { z } = require("zod");
const { sanitizeText } = require("../utils/sanitize");

const INGEST_STATUSES = ["PENDING", "PROCESSING", "PROCESSED", "REVIEW", "FAILED"];

const MIN_LIST_LIMIT = 1;
const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;
const MAX_CHANNEL_LENGTH = 50;

const uuidParam = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Must be a valid UUID." }),
  }),
});

const listLimit = z
  .preprocess(
    (val) => (val === undefined || val === null ? undefined : val),
    z.coerce.number().int().min(MIN_LIST_LIMIT).max(MAX_LIST_LIMIT).optional(),
  );

const listIngestionEventsSchema = z.object({
  query: z.object({
    status: z.enum(INGEST_STATUSES).optional(),
    channel: z.preprocess(
      (val) => {
        if (val === undefined || val === null) return undefined;
        const cleaned = sanitizeText(String(val));
        return cleaned === "" ? undefined : cleaned;
      },
      z.string().min(1, "Field 'channel' must be a non-empty string.").max(MAX_CHANNEL_LENGTH).optional(),
    ),
    limit: listLimit,
  }),
});

const listInsightsSchema = z.object({
  query: z.object({
    limit: listLimit,
  }),
});

module.exports = {
  retryParamSchema: uuidParam,
  ingestionIdParamSchema: uuidParam,
  listIngestionEventsSchema,
  listInsightsSchema,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MIN_LIST_LIMIT,
  INGEST_STATUSES,
};