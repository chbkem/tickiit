const asyncHandler = require("../middleware/asyncHandler");
const {
  listArticles,
  createArticle,
  updateArticle,
  deleteArticle,
} = require("../ai/knowledge/knowledgeService");
const { extractMarkdown, titleFromFileName } = require("../utils/fileFormats");
const { getKnowledgeConfig } = require("../config/knowledge");

exports.getArticles = asyncHandler(async (req, res) => {
  const articles = await listArticles({ orgId: req.knowledgeAdmin.orgId });
  res.json(articles);
});

exports.createArticle = asyncHandler(async (req, res) => {
  const { userId, orgId } = req.knowledgeAdmin;
  const article = await createArticle({
    actorId: userId,
    data: { ...req.body, orgId },
  });
  res.status(201).json(article);
});

exports.updateArticle = asyncHandler(async (req, res) => {
  const { userId, orgId } = req.knowledgeAdmin;
  const article = await updateArticle({
    id: req.params.id,
    orgId,
    actorId: userId,
    data: req.body,
  });
  res.json(article);
});

exports.deleteArticle = asyncHandler(async (req, res) => {
  const { userId, orgId } = req.knowledgeAdmin;
  await deleteArticle({ id: req.params.id, orgId, actorId: userId });
  res.status(204).send();
});

exports.uploadArticle = asyncHandler(async (req, res) => {
  const { userId, orgId } = req.knowledgeAdmin;
  const file = req.file;
  const { maxTextChars } = getKnowledgeConfig();

  const body = await extractMarkdown({
    buffer: file.buffer,
    fileName: file.originalname,
    mimeType: file.mimetype,
    maxChars: maxTextChars,
  });

  const article = await createArticle({
    actorId: userId,
    data: {
      orgId,
      title: titleFromFileName(file.originalname),
      body,
      source: "FILE",
      sourceUrl: null,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      tags: [],
    },
  });

  res.status(201).json(article);
});
