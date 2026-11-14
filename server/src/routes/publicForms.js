const express = require("express");
const publicFormsController = require("../controllers/publicForms");
const validate = require("../middleware/validate");
const { createLimiter } = require("../middleware/rateLimit");
const {
  publicIdParamSchema,
  submitFormSchema,
} = require("../validators/formSchemas");

const router = express.Router();

const submitLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  message: { error: "Too many submissions, please try again later." },
});

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
