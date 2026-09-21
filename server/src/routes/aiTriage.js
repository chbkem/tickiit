const express = require("express");
const aiTriageController = require("../controllers/aiTriage");
const validate = require("../middleware/validate");
const requireIngestToken = require("../middleware/requireIngestToken");
const { createLimiter } = require("../middleware/rateLimit");
const { triageRequestSchema } = require("../validators/aiTriageSchemas");

const router = express.Router();

const triageLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: { error: "Too many requests, please try again later." },
});

router.post(
  "/",
  triageLimiter,
  requireIngestToken,
  validate(triageRequestSchema),
  aiTriageController.triage,
);

module.exports = router;