const { z } = require("zod");
const { sanitizeText } = require("../utils/sanitize");

const MAX_CHANNEL_LENGTH = 50;
const MAX_EXTERNAL_ID_LENGTH = 200;
const MAX_IDENTIFIER_LENGTH = 200;
const MAX_RAW_LENGTH = 200000;

const cleanedRequired = (max, message) =>
  z.preprocess(
    (val) => (val === undefined || val === null ? val : sanitizeText(val) ?? ""),
    z.string().trim().min(1, message).max(max),
  );

const optionalIdentifier = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return undefined;
    const cleaned = sanitizeText(String(val));
    return cleaned === "" ? null : cleaned;
  },
  z.string().max(MAX_IDENTIFIER_LENGTH).nullable().optional(),
);

const deepClean = (val, depth = 0) => {
  if (typeof val === "string") {
    const cleaned = sanitizeText(val);
    return cleaned == null || cleaned === "" ? "" : cleaned;
  }
  if (Array.isArray(val)) return depth < 8 ? val.map((item) => deepClean(item, depth + 1)) : [];
  if (val != null && typeof val === "object") {
    if (depth >= 8) return {};
    const out = {};
    for (const [key, item] of Object.entries(val)) out[key] = deepClean(item, depth + 1);
    return out;
  }
  return val;
};

const rawPayload = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return val;
    if (typeof val === "string") return sanitizeText(val) ?? "";
    if (typeof val === "object") return deepClean(val);
    return val;
  },
  z.union([z.string(), z.record(z.string(), z.unknown())]).refine(
    (val) => JSON.stringify(val).length <= MAX_RAW_LENGTH,
    { message: `Field 'raw' must be at most ${MAX_RAW_LENGTH} characters.` },
  ),
);

const createIngestionSchema = z.object({
  body: z
    .object({
      channel: cleanedRequired(MAX_CHANNEL_LENGTH, "Field 'channel' must be a non-empty string."),
      externalId: cleanedRequired(MAX_EXTERNAL_ID_LENGTH, "Field 'externalId' must be a non-empty string."),
      raw: rawPayload,
      requesterRef: optionalIdentifier,
      orgId: optionalIdentifier,
    })
    .strict(),
});

module.exports = {
  createIngestionSchema,
  MAX_CHANNEL_LENGTH,
  MAX_EXTERNAL_ID_LENGTH,
  MAX_RAW_LENGTH,
};