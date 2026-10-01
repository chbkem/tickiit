const { randomUUID } = require("node:crypto");
const prisma = require("../../lib/prisma");
const logger = require("../../lib/logger");
const ApiError = require("../../utils/ApiError");
const { chunkText, DEFAULT_MAX_CHUNKS_PER_ARTICLE } = require("./chunker");
const { getEmbedder, normalizeVector, vectorToLiteral, assertDimension } = require("./embedder");

const MAX_CHUNKS_PER_ARTICLE = DEFAULT_MAX_CHUNKS_PER_ARTICLE;

const insertChunkRows = async (tx, articleId, rows) => {
  for (const row of rows) {
    if (row.embedding) {
      await tx.$executeRaw`
        INSERT INTO "KnowledgeChunk" (id, "articleId", "index", body, embedding)
        VALUES (${row.id}, ${articleId}, ${row.index}, ${row.body}, ${vectorToLiteral(row.embedding)}::vector)
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO "KnowledgeChunk" (id, "articleId", "index", body, embedding)
        VALUES (${row.id}, ${articleId}, ${row.index}, ${row.body}, ${null}::vector)
      `;
    }
  }
};

const embedChunks = async ({ chunks, embedder }) => {
  try {
    const vectors = await embedder.embedTexts(chunks.map((chunk) => chunk.body));
    if (typeof embedder.getConfig === "function") {
      const { dim } = embedder.getConfig();
      return vectors.map((vector) => {
        assertDimension(vector, dim);
        return normalizeVector(vector);
      });
    }
    return vectors;
  } catch (err) {
    logger.warn("Embedding model unavailable; storing chunks without embeddings so tag search still works", {
      error: err.message,
    });
    return null;
  }
};

const buildChunkRows = async ({ articleId, body, embedder }) => {
  if (!articleId || typeof body !== "string") {
    throw new ApiError(422, "An article id and body are required to ingest knowledge.");
  }

  const chunks = chunkText(body);
  if (chunks.length > MAX_CHUNKS_PER_ARTICLE) {
    throw new ApiError(
      422,
      `This article is too large. It would split into ${chunks.length} chunks but the limit is ${MAX_CHUNKS_PER_ARTICLE}.`,
    );
  }

  const embeddings = await embedChunks({ chunks, embedder });
  return {
    rows: chunks.map((chunk, index) => ({
      id: randomUUID(),
      articleId,
      index: chunk.index,
      body: chunk.body,
      embedding: embeddings ? embeddings[index] : null,
    })),
    embedded: Boolean(embeddings),
  };
};

const replaceChunkRows = async (tx, articleId, rows) => {
  await tx.knowledgeChunk.deleteMany({ where: { articleId } });
  await insertChunkRows(tx, articleId, rows);
};

const logIngestion = ({ articleId, orgId, operation, chunkCount, embedded, actorId }) => {
  logger.info("Knowledge article chunks replaced", {
    articleId,
    orgId,
    operation,
    chunkCount,
    embedded,
    actorId,
  });
};

const ingestArticle = async ({ article, db = prisma, embedder = getEmbedder() } = {}) => {
  if (!article || typeof article.id !== "string" || typeof article.body !== "string") {
    throw new ApiError(422, "An article id and body are required to ingest knowledge.");
  }

  const { rows, embedded } = await buildChunkRows({
    articleId: article.id,
    body: article.body,
    embedder,
  });

  const result = await db.$transaction(async (tx) => {
    await replaceChunkRows(tx, article.id, rows);
    return { articleId: article.id, chunkCount: rows.length, embedded };
  });

  logIngestion({
    articleId: article.id,
    orgId: article.orgId,
    operation: "reingest",
    chunkCount: rows.length,
    embedded,
  });
  return result;
};

const listArticles = async ({ orgId, db = prisma } = {}) => {
  if (!orgId) {
    throw new ApiError(400, "An org id is required to list knowledge articles.");
  }
  return db.knowledgeArticle.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
  });
};

const createArticle = async ({ data, actorId, db = prisma, embedder = getEmbedder() } = {}) => {
  if (!data || !data.orgId || !data.title || !data.body) {
    throw new ApiError(400, "An org id, title, and body are required to create a knowledge article.");
  }

  const id = randomUUID();
  const articleData = { ...data, tags: data.tags ?? [] };
  const { rows, embedded } = await buildChunkRows({ articleId: id, body: articleData.body, embedder });

  const article = await db.$transaction(async (tx) => {
    const created = await tx.knowledgeArticle.create({ data: { ...articleData, id } });
    await replaceChunkRows(tx, id, rows);
    return created;
  });

  logIngestion({
    articleId: id,
    orgId: data.orgId,
    operation: "create",
    chunkCount: rows.length,
    embedded,
    actorId,
  });
  return article;
};

const updateArticle = async ({ id, orgId, data, actorId, db = prisma, embedder = getEmbedder() } = {}) => {
  if (!id || !orgId || !data || typeof data !== "object" || Object.keys(data).length === 0) {
    throw new ApiError(400, "An article id, org id, and update fields are required.");
  }

  const existing = await db.knowledgeArticle.findFirst({ where: { id, orgId } });
  if (!existing) {
    throw new ApiError(404, "Knowledge article not found.");
  }

  const body = data.body === undefined ? existing.body : data.body;
  const { rows, embedded } = await buildChunkRows({ articleId: id, body, embedder });

  const article = await db.$transaction(async (tx) => {
    const where = { id, orgId };
    if (existing.updatedAt instanceof Date) {
      where.updatedAt = existing.updatedAt;
    }

    const claimed = await tx.knowledgeArticle.updateMany({ where, data });
    if (claimed.count === 0) {
      const current = await tx.knowledgeArticle.findFirst({ where: { id, orgId } });
      if (!current) {
        throw new ApiError(404, "Knowledge article not found.");
      }
      throw new ApiError(409, "This article changed while you were editing it. Reload it and try again.");
    }

    await replaceChunkRows(tx, id, rows);
    return tx.knowledgeArticle.findFirst({ where: { id, orgId } });
  });

  logIngestion({
    articleId: id,
    orgId,
    operation: "update",
    chunkCount: rows.length,
    embedded,
    actorId,
  });
  return article;
};

const deleteArticle = async ({ id, orgId, actorId, db = prisma } = {}) => {
  if (!id || !orgId) {
    throw new ApiError(400, "An article id and org id are required to delete a knowledge article.");
  }

  const result = await db.knowledgeArticle.deleteMany({ where: { id, orgId } });
  if (result.count === 0) {
    throw new ApiError(404, "Knowledge article not found.");
  }

  logger.info("Knowledge article deleted", { articleId: id, orgId, actorId });
  return { id };
};

const listChunksByArticle = async ({ articleId, orgId, db = prisma } = {}) => {
  if (!orgId || !articleId) {
    throw new ApiError(400, "An org id and an article id are required to list chunks.");
  }
  return db.knowledgeChunk.findMany({
    where: { articleId, article: { orgId } },
    orderBy: { index: "asc" },
    select: { id: true, index: true, body: true },
  });
};

module.exports = {
  MAX_CHUNKS_PER_ARTICLE,
  insertChunkRows,
  embedChunks,
  buildChunkRows,
  replaceChunkRows,
  ingestArticle,
  listArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  listChunksByArticle,
};
