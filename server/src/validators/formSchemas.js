const { z } = require("zod");
const { sanitizeText } = require("../utils/sanitize");

const cleanText = (value) => (typeof value === "string" ? sanitizeText(value) : value);

const formName = z.preprocess(
  cleanText,
  z
    .string()
    .trim()
    .min(1, "Form name is required.")
    .max(120, "Form name must be 120 characters or fewer."),
);

const formDescription = z
  .preprocess(
    (value) => {
      if (value === undefined || value === null) return value;
      if (typeof value !== "string") return value;
      const cleaned = sanitizeText(value);
      return cleaned === "" ? null : cleaned;
    },
    z.string().trim().min(1).max(500, "Description must be 500 characters or fewer.").nullable(),
  )
  .optional();

const publicIdParam = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{10,64}$/, "Invalid form link.");

const formIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Must be a valid UUID." }),
  }),
});

const publicIdParamSchema = z.object({
  params: z.object({
    publicId: publicIdParam,
  }),
});

const createFormSchema = z.object({
  body: z
    .object({
      name: formName.optional(),
      description: formDescription,
    })
    .strict()
    .default({}),
});

const updateFormSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Must be a valid UUID." }),
  }),
  body: z
    .object({
      name: formName.optional(),
      description: formDescription,
      isActive: z.boolean({ message: "isActive must be a boolean." }).optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
      message: "No valid update fields provided.",
    }),
});

const submitFormSchema = z.object({
  params: z.object({
    publicId: publicIdParam,
  }),
  body: z
    .object({
      name: z.preprocess(
        cleanText,
        z
          .string()
          .trim()
          .min(1, "Your name is required.")
          .max(100, "Name must be 100 characters or fewer."),
      ),
      email: z.preprocess(
        (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
        z.email({ message: "Enter a valid email address." }).max(254),
      ),
      subject: z.preprocess(
        cleanText,
        z
          .string()
          .trim()
          .min(1, "A subject is required.")
          .max(200, "Subject must be 200 characters or fewer."),
      ),
      message: z.preprocess(
        cleanText,
        z
          .string()
          .trim()
          .min(1, "A message is required.")
          .max(5000, "Message must be 5000 characters or fewer."),
      ),
      website: z.string().max(200).optional(),
      elapsedMs: z.number().int().nonnegative().optional(),
    })
    .strict(),
});

module.exports = {
  formIdParamSchema,
  publicIdParamSchema,
  createFormSchema,
  updateFormSchema,
  submitFormSchema,
};
