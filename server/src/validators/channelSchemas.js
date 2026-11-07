const { z } = require("zod");
const { sanitizeText } = require("../utils/sanitize");

const MAX_IDENTIFIER_LENGTH = 200;
const MAX_SUBJECT_LENGTH = 2000;
const MAX_BODY_LENGTH = 8000;

// A Telegram bot token is <numeric bot id>:<35 url safe base64 characters>. The
// shape is checked rather than the content, so a pasted token with stray
// whitespace is rejected with a clear message instead of failing later as an
// opaque 401 from Telegram. Never sanitized and never logged: it is a
// credential, not user authored text.
const BOT_TOKEN_PATTERN = /^\d{5,20}:[A-Za-z0-9_-]{30,50}$/;

const botToken = z
  .string()
  .trim()
  .regex(
    BOT_TOKEN_PATTERN,
    "That does not look like a Telegram bot token. Copy it from BotFather with no spaces.",
  );

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
//
// Creating a Telegram channel takes a token and nothing else: the identifier,
// display name, and bot id all come from Telegram's getMe response, so an admin
// cannot type a username that disagrees with the bot they pasted. Creating an
// email channel keeps the 0002 identifier field.
const createChannelSchema = z.object({
  body: z
    .discriminatedUnion("channel", [
      z
        .object({
          channel: z.literal("EMAIL"),
          identifier: z.preprocess(
            (val) => (val === undefined || val === null ? val : sanitizeText(String(val))),
            z.string().min(1).max(MAX_IDENTIFIER_LENGTH),
          ),
        })
        .strict(),
      z
        .object({
          channel: z.literal("TELEGRAM"),
          botToken,
        })
        .strict(),
    ]),
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

// Replacing the token on an existing bot. The body is identical to the Telegram
// branch of createChannelSchema; both routes call one service function.
const rotateTelegramTokenSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      botToken,
    })
    .strict(),
});

const testChannelSendSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      chatId: z
        .string()
        .trim()
        .regex(/^-?\d+$/, "A Telegram chat id is a number, positive or negative for a group."),
    })
    .strict(),
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
// `chat.type` is required by the private chat filter: group, supergroup, and
// channel posts create no ticket.
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
            type: z.string(),
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
  rotateTelegramTokenSchema,
  testChannelSendSchema,
  emailWebhookSchema,
  telegramWebhookSchema,
};