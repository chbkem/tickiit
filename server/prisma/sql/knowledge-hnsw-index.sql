-- knowledge-hnsw-index.sql
-- Creates the HNSW approximate nearest neighbor index over KnowledgeChunk
-- embeddings. The table must already exist (run `prisma db push` first), so
-- this runs after the schema push, against the direct connection URL:
--   npx prisma db execute --file prisma/sql/knowledge-hnsw-index.sql
-- Cosine distance matches the pgvector similarity search used by the
-- retriever. The statement is idempotent; you may run it again safely.
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_idx"
  ON "KnowledgeChunk"
  USING hnsw ("embedding" vector_cosine_ops);