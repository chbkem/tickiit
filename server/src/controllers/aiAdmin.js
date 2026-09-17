const { getAuth } = require("@clerk/express");

const prisma = require("../lib/prisma");
const clerkClient = require("../lib/clerk");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../middleware/asyncHandler");
const logger = require("../lib/logger");
const { knowledgeService, DEFAULT_SOURCE } = require("../ai/knowledge/knowledgeService");
const { runPipeline } = require("../ai/pipeline/runner");
const { createCircuitBreaker } = require("../ai/circuitBreaker");
const { KeywordKnowledgeRetriever } = require("../ai/knowledge/retriever");
const { DEFAULT_LIST_LIMIT } = require("../validators/aiAdminSchemas");

const orgScope = (orgId) => ({ orgId: { in: [orgId, null] } });

/**
 * Scoping rules for the org-admin knowledge base:
 *   - reads: an org admin sees their org's articles plus the global (orgId null) KB;
 *   - writes: articles belong to the caller's active org — cross-org writes are 403;
 *   - global articles are read-only to org admins;
 *   - a foreign article is masked as 404 (no existence leak).
 */
const assertReadable = (article, orgId) => {
  if (article.orgId !== null && article.orgId !== orgId) {
    throw new ApiError(404, "Article not found.");
  }
};

const assertWritable = (article, orgId) => {
  if (article.orgId === null) {
    throw new ApiError(403, "Global articles are read-only.");
  }
  if (article.orgId !== orgId) {
    throw new ApiError(404, "Article not found.");
  }
};

exports.getArticles = asyncHandler(async (req, res) => {
  const { orgId } = getAuth(req);
  const search = req.query.search;
  const limit = req.query.limit ?? undefined;

  const articles = await knowledgeService.list({ orgId, search, limit });
  res.json(articles);
});

exports.getArticleById = asyncHandler(async (req, res) => {
  const { orgId } = getAuth(req);

  const article = await knowledgeService.getById(req.params.id);
  if (!article) {
    throw new ApiError(404, "Article not found.");
  }

  assertReadable(article, orgId);
  res.json(article);
});

exports.createArticle = asyncHandler(async (req, res) => {
  const { orgId } = getAuth(req);
  const body = req.body;

  if (body.orgId != null && body.orgId !== orgId) {
    throw new ApiError(403, "Articles can only be created in your active organization.");
  }

  const article = await knowledgeService.create({
    data: {
      title: body.title,
      body: body.body,
      tags: body.tags,
      source: body.source ?? DEFAULT_SOURCE,
      orgId,
    },
  });

  logger.info("Knowledge article created", {
    articleId: article.id,
    actorId: getAuth(req).userId,
    orgId,
  });

  res.status(201).json(article);
});

exports.updateArticle = asyncHandler(async (req, res) => {
  const { userId, orgId } = getAuth(req);
  const body = req.body;

  const existing = await knowledgeService.getById(req.params.id);
  if (!existing) {
    throw new ApiError(404, "Article not found.");
  }

  assertWritable(existing, orgId);

  const data = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.body !== undefined) data.body = body.body;
  if (body.tags !== undefined) data.tags = body.tags;
  if (body.source !== undefined) data.source = body.source;
  if (body.orgId !== undefined) {
    if (body.orgId != null && body.orgId !== orgId) {
      throw new ApiError(403, "Articles can only be moved within your active organization.");
    }
    data.orgId = orgId;
  }

  const article = await knowledgeService.update(existing.id, data);

  logger.info("Knowledge article updated", {
    articleId: article.id,
    actorId: userId,
    orgId,
    changes: Object.keys(data),
  });

  res.json(article);
});

exports.deleteArticle = asyncHandler(async (req, res) => {
  const { userId, orgId } = getAuth(req);

  const existing = await knowledgeService.getById(req.params.id);
  if (!existing) {
    throw new ApiError(404, "Article not found.");
  }

  assertWritable(existing, orgId);

  await knowledgeService.remove(existing.id);

  logger.info("Knowledge article deleted", {
    articleId: existing.id,
    actorId: userId,
    orgId,
  });

  res.json({ message: "Article deleted successfully.", id: existing.id });
});

/**
 * GET /api/ai/admin/insights — the human review queue.
 *
 * Lists ingestion events parked in REVIEW (below the confidence gate, breaker
 * tripped, or a deterministic/apply fallback) together with their stored
 * suggestion. Global scoping mirrors listKnowledge: own org + org-agnostic.
 */
exports.getInsights = asyncHandler(async (req, res) => {
  const orgId = req.orgId ?? getAuth(req).orgId;
  const limit = req.query.limit ?? DEFAULT_LIST_LIMIT;

  const events = await prisma.ingestionEvent.findMany({
    where: { status: "REVIEW", aiReviewRequired: true, ...orgScope(orgId) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  logger.info("Review queue listed", { actorId: getAuth(req).userId, orgId, count: events.length });

  res.json({
    data: events.map(({ rawPayload, suggestion, ...event }) => ({ ...event, suggestion })),
    count: events.length,
  });
});

/**
 * POST /api/ai/admin/dry-run — synchronous pipeline trace with zero writes.
 *
 * Feeds a synthetic (unpersisted) IngestionEvent through the exact worker
 * code path (normalize → enrich → agent → decide → disposition) with
 * deps.dryRun=true so apply/record/failed stages are skipped. The caller's
 * org-scoped context is used so the preview matches what the worker would do
 * for the same input, without leaking another org's data.
 */
exports.dryRun = asyncHandler(async (req, res) => {
  const orgId = req.orgId ?? getAuth(req).orgId;
  const actorId = getAuth(req).userId;

  const body = req.body;
  if (body.orgId != null && body.orgId !== orgId) {
    throw new ApiError(403, "Dry-run is limited to your active organization.");
  }

  const event = {
    id: "dry-run",
    channel: body.channel,
    externalId: body.externalId,
    requesterRef: body.requesterRef ?? null,
    orgId: body.orgId ?? orgId,
    rawPayload: body.raw,
    status: "PENDING",
    attempts: 0,
  };

  const resource = await runPipeline({
    event,
    deps: {
      dryRun: true,
      prisma,
      clerkClient,
      knowledgeRetriever: new KeywordKnowledgeRetriever({ prisma }),
      breaker: createCircuitBreaker(),
      env: process.env,
      logger,
    },
  });

  const { result } = resource;
  logger.info("AI dry-run executed", {
    actorId,
    orgId,
    disposition: resource.disposition,
    provider: result?.provider ?? null,
    model: result?.model ?? null,
    outcome: result?.status ?? null,
  });

  res.json({
    disposition: resource.disposition,
    suggestion: resource.suggestion ?? null,
    decision: result?.decision ?? null,
    confidence: result?.confidence ?? null,
    provider: result?.provider ?? null,
    model: result?.model ?? null,
    fallback: result?.fallback ?? null,
    usage: result?.usage ?? null,
    trace: result?.trace ?? null,
    error: resource.error ?? null,
  });
});