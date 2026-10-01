const { z } = require("zod");
const { sanitizeText } = require("../utils/sanitize");

const MAX_IDENTIFIER_LENGTH = 200;
const MAX_SUBJECT_LENGTH = 2000;
const MAX_BODY_LENGTH = 8000;

const cleanString = (max) =>
  z.preprocess(
    (val) => {
      if (val === undefined || val === null) return val;
      const cleaned = sanitizeText(String(val));
      return cleaned === "" ? null : cleaned;
    },
    z.string().max(max).nullable().optional(),
  );

const channelType = z.enum(["EMAIL", "TELEGRAM"]);

// Channel CRUD schemas
const createChannelSchema = z.object({
  body: z
    .object({
      channel: channelType,
      identifier: cleanString(MAX_IDENTIFIER_LENGTH),
    })
    .strict(),
});

const updateChannelSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field must be provided for update.",
    }),
});

const deleteChannelSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// Email webhook schema
// `to` is the recipient support address that identifies the channel and its org.
const emailWebhookSchema = z.object({
  body: z
    .object({
      to: z.string().max(MAX_IDENTIFIER_LENGTH),
      from: z.string().max(MAX_IDENTIFIER_LENGTH),
      subject: z.string().max(MAX_SUBJECT_LENGTH),
      body: z.string().max(MAX_BODY_LENGTH),
      messageId: z.string().max(MAX_IDENTIFIER_LENGTH),
    })
    .strict(),
});

// Telegram webhook schema (Telegram Update object)
const telegramWebhookSchema = z.object({
  body: z
    .object({
      update_id: z.number(),
      message: z
        .object({
          message_id: z.number(),
          from: z.object({
            id: z.number(),
            first_name: z.string().optional(),
            last_name: z.string().optional(),
          }),
          chat: z.object({
            id: z.number(),
          }),
          text: z.string().optional(),
        })
        .optional(),
    })
    .strict(),
});

module.exports = {
  createChannelSchema,
  updateChannelSchema,
  deleteChannelSchema,
  emailWebhookSchema,
  telegramWebhookSchema,
};
