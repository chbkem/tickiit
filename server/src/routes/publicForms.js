const express = require("express");
const publicFormsController = require("../controllers/publicForms");
const validate = require("../middleware/validate");
const { createLimiter } = require("../middleware/rateLimit");
const {
  publicIdParamSchema,
  submitFormSchema,
} = require("../validators/formSchemas");
const { IP_LIMIT, IP_WINDOW_MS } = require("../spam/spamRules");

const router = express.Router();

const submitLimiter = createLimiter({
  windowMs: IP_WINDOW_MS,
  limit: IP_LIMIT,
  message: { error: "Too many submissions, please try again later." },
});

router.get(
  "/:publicId/challenge",
  validate(publicIdParamSchema),
  publicFormsController.getChallenge,
);
router.get(
  "/:publicId",
  validate(publicIdParamSchema),
  publicFormsController.getPublicForm,
);
router.post(
  "/:publicId/submit",
  submitLimiter,
  validate(submitFormSchema),
  publicFormsController.submitPublicForm,
);

module.exports = router;
