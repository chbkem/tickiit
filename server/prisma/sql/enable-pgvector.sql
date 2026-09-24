-- enable-pgvector.sql
-- Makes the Postgres vector type available so Prisma db push can create the
-- "vector(384)" column on KnowledgeChunk. Run against the direct connection
-- URL (prisma7.config.ts datasource) before `prisma db push`:
--   npx prisma db execute --file prisma/sql/enable-pgvector.sql
-- The statement is idempotent; you may run it again safely.
CREATE EXTENSION IF NOT EXISTS vector;