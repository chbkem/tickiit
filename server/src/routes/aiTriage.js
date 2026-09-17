const express = require("express");
const rateLimit = require("express-rate-limit");
const aiTriageController = require("../controllers/aiTriage");
const validate = require("../middleware/validate");
const requireIngestToken = require("../middleware/requireIngestToken");
const { triageRequestSchema } = require("../validators/aiTriageSchemas");

const router = express.Router();

const triageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
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