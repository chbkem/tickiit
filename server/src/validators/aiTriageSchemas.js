const { z } = require("zod");
const { sanitizeText } = require("../utils/sanitize");

const MAX_CHANNEL_LENGTH = 50;
const MAX_IDENTIFIER_LENGTH = 200;
const MAX_NAME_LENGTH = 200;
const MAX_RAW_LENGTH = 200000;

const optionalCleaned = (max) =>
  z.preprocess(
    (val) => {
      if (val === undefined || val === null) return val;
      const cleaned = sanitizeText(String(val));
      return cleaned === "" ? null : cleaned;
    },
    z.string().max(max).nullable().optional(),
  );

const deepClean = (val, depth = 0) => {
  if (typeof val === "string") return sanitizeText(val) ?? "";
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

const autoReply = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return val;
    if (val === true || val === "true" || val === 1) return true;
    if (val === false || val === "false" || val === 0) return false;
    return val;
  },
  z.boolean().optional(),
);

const triageRequestSchema = z.object({
  body: z
    .object({
      raw: rawPayload,
      channel: optionalCleaned(MAX_CHANNEL_LENGTH).default("UNKNOWN"),
      requesterRef: optionalCleaned(MAX_IDENTIFIER_LENGTH),
      name: optionalCleaned(MAX_NAME_LENGTH),
      email: optionalCleaned(MAX_NAME_LENGTH),
      orgId: optionalCleaned(MAX_IDENTIFIER_LENGTH),
      autoReply,
    })
    .strict()
    .refine((body) => body.requesterRef || (body.name && body.email), {
      message: "Provide 'requesterRef', or both 'name' and 'email', to identify the requester.",
    })
    .refine(
      (body) => {
        if (body.raw === undefined || body.raw === null) return false;
        if (typeof body.raw === "string") return body.raw.trim().length > 0;
        return Object.keys(body.raw).length > 0;
      },
      { message: "Field 'raw' must not be empty." },
    ),
});

module.exports = {
  triageRequestSchema,
  MAX_CHANNEL_LENGTH,
  MAX_IDENTIFIER_LENGTH,
  MAX_NAME_LENGTH,
  MAX_RAW_LENGTH,
};