const express = require("express");
const rateLimit = require("express-rate-limit");
const aiAdminController = require("../controllers/aiAdmin");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const requireOrgAdmin = require("../middleware/requireOrgAdmin");
const {
  knowledgeIdParamSchema,
  createKnowledgeSchema,
  updateKnowledgeSchema,
  listKnowledgeSchema,
} = require("../validators/knowledgeSchemas");
const { createIngestionSchema } = require("../validators/ingestionSchemas");
const { listInsightsSchema } = require("../validators/aiAdminSchemas");

const router = express.Router();

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

router.use(requireAuth);
router.use(requireOrgAdmin);

router.get("/knowledge", validate(listKnowledgeSchema), aiAdminController.getArticles);
router.get("/knowledge/:id", validate(knowledgeIdParamSchema), aiAdminController.getArticleById);
router.post("/knowledge", writeLimiter, validate(createKnowledgeSchema), aiAdminController.createArticle);
router.patch("/knowledge/:id", writeLimiter, validate(updateKnowledgeSchema), aiAdminController.updateArticle);
router.delete("/knowledge/:id", writeLimiter, validate(knowledgeIdParamSchema), aiAdminController.deleteArticle);

router.get("/insights", validate(listInsightsSchema), aiAdminController.getInsights);
router.post("/dry-run", writeLimiter, validate(createIngestionSchema), aiAdminController.dryRun);

module.exports = router;