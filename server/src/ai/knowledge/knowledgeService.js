const prisma = require("../../lib/prisma");
const { sanitizeText } = require("../../utils/sanitize");

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const MAX_TAG_LENGTH = 50;
const MAX_TAGS = 10;
const DEFAULT_SOURCE = "MANUAL";

const cleanString = (value) => {
  const cleaned = sanitizeText(value);
  return cleaned == null || cleaned === "" ? null : cleaned;
};

const cleanTags = (tags) =>
  (Array.isArray(tags) ? tags : [])
    .map((tag) => sanitizeText(String(tag)))
    .filter(Boolean)
    .map((tag) => tag.slice(0, MAX_TAG_LENGTH))
    .slice(0, MAX_TAGS);

/**
 * KnowledgeArticle service — org-scoped CRUD.
 *
 * Articles are scoped to an org (orgId = null means global KB, always in scope
 * for reads). Search is a keyword `contains` match across title/body/tags —
 * the same retrieval path the KeywordKnowledgeRetriever uses, minus ranking.
 * A factory (createKnowledgeService) keeps the prisma dependency injectable for
 * unit tests; the module exports a default instance bound to the real client.
 */
const createKnowledgeService = (client) => ({
  async list({ orgId, search, limit = DEFAULT_LIST_LIMIT } = {}) {
    const take = Math.min(Math.max(Math.floor(limit), 1), MAX_LIST_LIMIT);
    const where = { AND: [orgId != null ? { OR: [{ orgId }, { orgId: null }] } : { orgId: null }] };
    if (search) {
      where.AND.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { body: { contains: search, mode: "insensitive" } },
          { tags: { has: search } },
        ],
      });
    }
    return client.knowledgeArticle.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take,
    });
  },

  async getById(id) {
    return client.knowledgeArticle.findUnique({ where: { id } });
  },

  async create({ data }) {
    return client.knowledgeArticle.create({
      data: {
        title: cleanString(data.title),
        body: cleanString(data.body),
        tags: cleanTags(data.tags),
        source: cleanString(data.source) ?? DEFAULT_SOURCE,
        orgId: data.orgId ?? null,
      },
    });
  },

  async update(id, data) {
    const updates = {};
    if (data.title !== undefined) updates.title = cleanString(data.title);
    if (data.body !== undefined) updates.body = cleanString(data.body);
    if (data.tags !== undefined) updates.tags = cleanTags(data.tags);
    if (data.source !== undefined) updates.source = cleanString(data.source) ?? DEFAULT_SOURCE;
    if (data.orgId !== undefined) updates.orgId = data.orgId ?? null;
    return client.knowledgeArticle.update({ where: { id }, data: updates });
  },

  async remove(id) {
    return client.knowledgeArticle.delete({ where: { id } });
  },
});

const knowledgeService = createKnowledgeService(prisma);

module.exports = { knowledgeService, createKnowledgeService, DEFAULT_SOURCE, DEFAULT_LIST_LIMIT };