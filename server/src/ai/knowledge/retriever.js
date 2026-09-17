const { sanitizeText } = require("../../utils/sanitize");

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MAX_TITLE_LENGTH = 500;
const MAX_SNIPPET_LENGTH = 400;
const MAX_SEARCH_TERMS = 8;
const FETCH_POOL = 50;
const MAX_TAGS_SHOWN = 5;

// Relevance bands derived from the keyword-match score:
// title term = 3 points, tag term = 2 points, body term = 1 point, so a
// title-only hit (3) is high, a tag-only hit (2) is medium, a body-only hit (1) is low.
const HIGH_SCORE = 3;
const MEDIUM_SCORE = 2;

/**
 * KnowledgeRetriever — the seam between the agent and knowledge retrieval.
 *
 * Phase 1 ships KeywordKnowledgeRetriever (org-scoped substring search over
 * KnowledgeArticle). Phase 2 swaps in a vector-backed implementation (pgvector)
 * behind this same search({ orgId, query, limit }) contract, so the
 * search_knowledge tool and the pipeline never change. Any retriever must:
 *   - scope results to the org (global articles with orgId = null always apply),
 *   - cap/rank results by relevance,
 *   - sanitize and truncate every string before it can reach the model.
 */
class KnowledgeRetriever {
  async search() {
    throw new Error("KnowledgeRetriever.search({ orgId, query, limit }) must be implemented");
  }
}

const clampLimit = (limit) => {
  const n = Number(limit);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
};

const termsOf = (query) =>
  typeof query === "string"
    ? query
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean)
        .slice(0, MAX_SEARCH_TERMS)
    : [];

const snippetAround = (body, terms) => {
  const text = sanitizeText(body) || "";
  if (!text) return "";
  const lower = text.toLowerCase();
  const term = terms.find((t) => lower.includes(t.toLowerCase()));
  const idx = term ? lower.indexOf(term.toLowerCase()) : -1;
  if (idx >= 0) {
    const start = Math.max(0, idx - Math.floor(MAX_SNIPPET_LENGTH / 3));
    const window = text.slice(start, start + MAX_SNIPPET_LENGTH);
    return `${start > 0 ? "…" : ""}${window}${start + MAX_SNIPPET_LENGTH < text.length ? "…" : ""}`;
  }
  return text.length > MAX_SNIPPET_LENGTH ? `${text.slice(0, MAX_SNIPPET_LENGTH)}…` : text;
};

const scoreArticle = (article, terms) => {
  const lt = article.title?.toLowerCase() ?? "";
  const lb = article.body?.toLowerCase() ?? "";
  const tags = Array.isArray(article.tags) ? article.tags.map((t) => t.toLowerCase()) : [];
  let score = 0;
  for (const term of terms) {
    const needle = term.toLowerCase();
    if (lt.includes(needle)) score += 3;
    if (tags.includes(needle)) score += 2;
    if (lb.includes(needle)) score += 1;
  }
  return score;
};

const relevanceOf = (score) => (score >= HIGH_SCORE ? "high" : score >= MEDIUM_SCORE ? "medium" : "low");

/**
 * KeywordKnowledgeRetriever — deterministic, org-scoped substring search over
 * KnowledgeArticle. Ranked by term hits (title > tags > body); relevance is a
 * three-band label. Output strings are sanitized and capped so a hostile
 * article body can never smuggle content into prompt context unmodified.
 */
class KeywordKnowledgeRetriever extends KnowledgeRetriever {
  constructor({ prisma } = {}) {
    super();
    this.prisma = prisma;
  }

  buildWhere(orgId, terms) {
    const orgScope = orgId == null ? { orgId: null } : { OR: [{ orgId }, { orgId: null }] };
    const termsOr = terms.map((term) => ({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { body: { contains: term, mode: "insensitive" } },
        { tags: { has: term } },
      ],
    }));
    return { AND: [orgScope, { OR: termsOr }] };
  }

  async search({ orgId = null, query, limit = DEFAULT_LIMIT } = {}) {
    const terms = termsOf(query);
    const hitLimit = clampLimit(limit);
    if (terms.length === 0) return { query: sanitizeText(query) ?? "", orgId: orgId ?? null, hits: [], hitCount: 0 };

    const where = this.buildWhere(orgId, terms);
    const articles = await this.prisma.knowledgeArticle.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: FETCH_POOL,
    });

    const scored = articles
      .map((article) => ({ article, score: scoreArticle(article, terms) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || (a.article.updatedAt?.getTime?.() ?? 0) - (b.article.updatedAt?.getTime?.() ?? 0));

    const hits = scored.slice(0, hitLimit).map(({ article, score }) => ({
      id: article.id,
      title: (sanitizeText(article.title) || "Untitled").slice(0, MAX_TITLE_LENGTH),
      snippet: snippetAround(article.body, terms),
      tags: (Array.isArray(article.tags) ? article.tags : [])
        .map((tag) => sanitizeText(tag))
        .filter(Boolean)
        .slice(0, MAX_TAGS_SHOWN),
      source: sanitizeText(article.source) ?? null,
      relevance: relevanceOf(score),
    }));

    return { query: sanitizeText(query) ?? "", orgId: orgId ?? null, hits, hitCount: scored.length };
  }
}

module.exports = {
  KnowledgeRetriever,
  KeywordKnowledgeRetriever,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  clampLimit,
  termsOf,
};