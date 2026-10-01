const { getEmbedder, normalizeVector, vectorToLiteral, assertDimension } = require("./embedder");
const prisma = require("../../lib/prisma");
const logger = require("../../lib/logger");

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 50;
const MAX_KEYWORDS = 10;
const MIN_KEYWORD_LENGTH = 3;
const MAX_FALLBACK_BODY_CHARS = 1200;

const extractKeywords = (query) => {
  const tokens = String(query || "").match(/[a-zA-Z0-9_]+/g) || [];
  const seen = new Set();
  const terms = [];
  for (const token of tokens) {
    const key = token.toLowerCase();
    if (key.length < MIN_KEYWORD_LENGTH) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(token);
    if (terms.length >= MAX_KEYWORDS) break;
  }
  return terms;
};

const resolveTopK = (topK) => {
  const parsed = Number(topK);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TOP_K;
  return Math.min(Math.floor(parsed), MAX_TOP_K);
};

const cropBody = (body, max = MAX_FALLBACK_BODY_CHARS) => {
  const text = String(body || "");
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}....`;
};

const scoreArticle = (article, terms) => {
  const title = String(article.title || "").toLowerCase();
  const body = String(article.body || "").toLowerCase();
  const tags = (article.tags || []).map((tag) => String(tag).toLowerCase());
  let score = 0;
  for (const term of terms) {
    const key = term.toLowerCase();
    if (title.includes(key)) score += 3;
    if (body.includes(key)) score += 1;
    if (tags.some((tag) => tag === key)) score += 2;
  }
  return score;
};

const mapChunkRow = (row) => ({
  chunkId: row.id,
  articleId: row.articleId,
  articleTitle: row.title,
  index: row.index,
  body: row.body,
  score: Number(row.similarity ?? 0),
});

const semanticSearch = async ({ orgId, query, topK, db, embedder }) => {
  const { dim } = embedder.getConfig();
  const embedding = normalizeVector(await embedder.embedText(query));
  assertDimension(embedding, dim);
  const literal = vectorToLiteral(embedding);
  const rows = await db.$queryRaw`
    SELECT c.id, c."articleId", c.index, c.body, a.title,
           1 - (c.embedding <=> ${literal}::vector) AS similarity
    FROM "KnowledgeChunk" c
    JOIN "KnowledgeArticle" a ON a.id = c."articleId"
    WHERE a."orgId" = ${orgId}
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${literal}::vector
    LIMIT ${topK}
  `;
  return { kind: "semantic", query, chunks: (Array.isArray(rows) ? rows : []).map(mapChunkRow) };
};

const tagFallback = async ({ orgId, terms, topK, db }) => {
  const seed = Math.min(topK * 4, 100);
  const or = [];
  for (const term of terms) {
    const key = term.toLowerCase();
    or.push({ title: { contains: term, mode: "insensitive" } });
    or.push({ body: { contains: term, mode: "insensitive" } });
    or.push({ tags: { has: term } });
    if (key !== term) or.push({ tags: { has: key } });
  }
  const articles = await db.knowledgeArticle.findMany({
    where: { orgId, OR: or },
    select: { id: true, title: true, body: true, tags: true },
    take: seed,
  });
  const ranked = (Array.isArray(articles) ? articles : [])
    .map((article) => ({ article, score: scoreArticle(article, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return {
    chunks: ranked.map(({ article, score }) => ({
      chunkId: null,
      articleId: article.id,
      articleTitle: article.title,
      index: null,
      body: cropBody(article.body),
      score,
    })),
  };
};

const retrieveKnowledge = async ({ orgId, query, topK, db = prisma, embedder = getEmbedder() } = {}) => {
  const q = String(query || "").trim();
  if (!orgId || !q) return { kind: "empty", query: q, chunks: [] };

  const terms = extractKeywords(q);
  if (!terms.length) return { kind: "empty", query: q, chunks: [] };
  const k = resolveTopK(topK);

  let semantic = null;
  try {
    semantic = await semanticSearch({ orgId, query: q, topK: k, db, embedder });
  } catch (err) {
    logger.warn("Semantic retrieval unavailable, using tag fallback", {
      orgId,
      error: err.message,
    });
  }
  if (semantic && semantic.chunks.length) return semantic;

  const fallback = await tagFallback({ orgId, terms, topK: k, db });
  if (fallback.chunks.length) {
    return { kind: "fallback", query: q, chunks: fallback.chunks };
  }
  return { kind: "empty", query: q, chunks: [] };
};

module.exports = {
  DEFAULT_TOP_K,
  MAX_TOP_K,
  MAX_KEYWORDS,
  MIN_KEYWORD_LENGTH,
  MAX_FALLBACK_BODY_CHARS,
  extractKeywords,
  resolveTopK,
  cropBody,
  scoreArticle,
  mapChunkRow,
  semanticSearch,
  tagFallback,
  retrieveKnowledge,
};