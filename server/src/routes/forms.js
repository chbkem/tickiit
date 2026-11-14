const express = require("express");
const formsController = require("../controllers/forms");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { createLimiter } = require("../middleware/rateLimit");
const {
  formIdParamSchema,
  createFormSchema,
  updateFormSchema,
} = require("../validators/formSchemas");

const router = express.Router();

const writeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { error: "Too many requests, please try again later." },
});

router.use(requireAuth);

router.get("/", formsController.listForms);
router.post("/", writeLimiter, validate(createFormSchema), formsController.createForm);
router.patch("/:id", writeLimiter, validate(updateFormSchema), formsController.updateForm);
router.delete("/:id", writeLimiter, validate(formIdParamSchema), formsController.deleteForm);

module.exports = router;
