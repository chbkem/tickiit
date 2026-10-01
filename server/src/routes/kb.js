const express = require("express");
const kbController = require("../controllers/kb");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { requireKnowledgeAdmin } = require("../middleware/requireKnowledgeAdmin");
const { uploadKnowledgeFile } = require("../middleware/kbUpload");
const { createLimiter } = require("../middleware/rateLimit");
const { idParamSchema, createArticleSchema, updateArticleSchema } = require("../validators/kbSchemas");

const router = express.Router();

const writeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { error: "Too many requests, please try again later." },
});

router.use(requireAuth);
router.use(requireKnowledgeAdmin);

router.get("/articles", kbController.getArticles);
router.post("/articles", writeLimiter, validate(createArticleSchema), kbController.createArticle);
router.patch(
  "/articles/:id",
  writeLimiter,
  validate(updateArticleSchema),
  kbController.updateArticle,
);
router.delete("/articles/:id", writeLimiter, validate(idParamSchema), kbController.deleteArticle);
router.post("/upload", writeLimiter, uploadKnowledgeFile, kbController.uploadArticle);

module.exports = router;
