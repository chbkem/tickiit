const express = require("express");
const rateLimit = require("express-rate-limit");
const ingestionController = require("../controllers/ingestion");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const requireOrgAdmin = require("../middleware/requireOrgAdmin");
const requireIngestToken = require("../middleware/requireIngestToken");
const {
  createIngestionSchema,
} = require("../validators/ingestionSchemas");
const {
  retryParamSchema,
  listIngestionEventsSchema,
} = require("../validators/aiAdminSchemas");

const router = express.Router();

const ingestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

router.post(
  "/",
  ingestLimiter,
  requireIngestToken,
  validate(createIngestionSchema),
  ingestionController.createIngestion,
);

router.get(
  "/",
  requireAuth,
  requireOrgAdmin,
  validate(listIngestionEventsSchema),
  ingestionController.listEvents,
);

router.post(
  "/:id/retry",
  requireAuth,
  requireOrgAdmin,
  validate(retryParamSchema),
  ingestionController.retryEvent,
);

module.exports = router;