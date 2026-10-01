# server/src/ai/knowledge

## Overview

The knowledge base. An admin uploads or pastes a document, the server chunks it, embeds each chunk into a pgvector column, and stores both the article and its chunks in one transaction. Retrieval searches those vectors and falls back to tag and title matching when the embedding model is unavailable. It is the newest feature in the repo: the storage and ingestion side is done, retrieval is done, and neither is wired into a model or a page yet.

## Key files

| File | Owns |
|---|---|
| `knowledgeService.js` | `createArticle`, `updateArticle`, `deleteArticle`, `listArticles`, plus the raw chunk insert. The service layer for this area |
| `chunker.js` | Pure. Splits on blank lines, hard splits over the cap at a sentence boundary, returns `{ index, body }` |
| `embedder.js` | The memoized Transformer.js pipeline, plus `normalizeVector`, `vectorToLiteral`, `assertDimension` |
| `retriever.js` | `retrieveKnowledge`, `semanticSearch` through raw SQL, and `tagFallback` through the typed client |
| `../../config/knowledge.js` | `getKnowledgeConfig(env)`, the upload size and text length limits. Throws on a bad value rather than defaulting |
| `../../middleware/kbUpload.js` | The multer memory storage upload, and the mapping from multer errors to `ApiError` |
| `../../utils/fileFormats.js` | txt, md, pdf, and docx to markdown, with the 415 and 422 messages |
| `../../middleware/requireKnowledgeAdmin.js` | Org admin guard. Sets `req.knowledgeAdmin` |
| `../../routes/kb.js` | List, create, patch, delete, and upload. Admin only for the whole router, reads included |
| `../../controllers/kb.js` | Calls `knowledgeService` directly, so this area has no `services/` layer |

## HTTP surface

| Route | Notes |
|---|---|
| `GET /api/kb/articles` | List for the session org |
| `POST /api/kb/articles` | Create from a JSON body |
| `PATCH /api/kb/articles/:id` | Rebuilds chunks from the effective body, even for a title only change |
| `DELETE /api/kb/articles/:id` | Chunks go with the article through the cascade |
| `POST /api/kb/upload` | One document in the `file` field. Text is extracted before anything is written |

## Conventions

- **The vector column is `Unsupported("vector(384)")?`,** so Prisma 7 cannot read or write it through the typed client. Only the chunk insert and the vector search use `$executeRaw` or `$queryRaw`, and both need an explicit `::vector` cast. Everything else, article CRUD and the chunk listing, uses the normal client.
- **The `?` on the column means two insert branches:** one that casts a real vector literal and one that casts `null`. Storing `null` is what keeps an article searchable by tag when the model is down.
- **The embedder is never loaded eagerly.** Every call site takes `embedder = getEmbedder()` as a default parameter, so the object is built but the model only loads on the first `embedTexts`.
- **`getEmbedder` memoizes one instance per process,** and the memoized promise is cached even when it rejects. A failed download is sticky for the life of the process.
- **Ingestion never fails because of embeddings.** `embedChunks` catches, warns once, and returns `null`, so the article and its chunks are still stored. When the embedder does expose a config, every vector is dimension checked and normalized to unit length before it is written.
- **`updateArticle` is a compare and swap.** It matches on `updatedAt` and returns a 409 telling the caller to reload, rather than silently overwriting a concurrent edit.
- **A failure rolls back the article.** Chunk insert and article create share one `$transaction`, so a bad insert leaves nothing behind.
- **Over 1000 chunks is a 422 raised before the first embedding call,** deliberately, so a pathological document cannot spend money on embeddings it will not store.
- **Extraction runs before the write.** A scanned or password protected PDF creates nothing.

## Gotchas

- **An embedder missing `getConfig()` fails silently, not loudly.** `semanticSearch` calls it directly and `embedChunks` guards on it, so a missing method means every search quietly drops to the tag fallback and stored vectors are never dimension checked. `createEmbedder` exposes `getConfig` alongside the `config` property, and `retriever.test.js` drives the real embedder through `retrieveKnowledge` to keep that honest. Test doubles here must expose the same surface as the real embedder.
- **The first ingestion or search downloads about 25 MB of ONNX weights and blocks on it.** Set `AI_EMBEDDING_CACHE_DIR` to a mounted volume in Docker or every restart pays it again.
- **`AI_EMBEDDING_TOP_K` is documented in `.env.example` but never read.** `retriever.js` hardcodes a default of 5 and caps at 50. Change the code, not the env var.
- **`AI_EMBEDDING_DIM` must match the column.** A mismatch is now caught by `assertDimension` before the write, and ingestion degrades to null embeddings with a warning rather than handing Postgres a vector it will reject. The search side still falls back to tags, so a wrong value quietly costs you the vector search without ever erroring.
- **`sanitizeText` runs after the conversion,** and it strips every tag. The docx path goes to HTML and then to markdown and then loses any literal HTML an author wrote on purpose.
- **Every route on this router is admin only,** including the list. There is no read only role, and `req.knowledgeAdmin.orgId` is the only org source. A body `orgId` is always overwritten.
- **The two SQL files are hand run and the order matters:** `prisma/sql/enable-pgvector.sql` before `prisma db push`, then `prisma/sql/knowledge-hnsw-index.sql` after it.
- **Scanned PDFs have no text layer and are rejected with a 422.** There is no OCR. `.doc` is rejected too; the message tells the user to save as `.docx`.
- **Uploads are buffered whole in memory** by multer, up to `KB_MAX_UPLOAD_BYTES` (10 MB by default). The global `json` limit of 16kb does not apply to `multipart/form-data`.
- **`ingestArticle` and `listChunksByArticle` are exported and tested but nothing calls them.** `updateArticle` inlines the same logic.

## What is not built

- The `search_knowledge` tool. `retrieveKnowledge` has no production caller, so no model can read the knowledge base yet. This is acceptance criterion 6 in the spec.
- `POST /api/ai/comments/:commentId/reply`, the comment reply draft endpoint. No route, controller, or validator exists. The existing reply agent is wired to triage and takes no citations.
- The whole client side: no page, no editor, no upload area, no sidebar entry, no action or hook. `client/src` has zero references to the knowledge base.
- Retrieval logging. Ingestion logs the chunk count and whether embedding succeeded; searches log nothing.
- URL and video sources. The enum values exist, nothing imports them.

## Related specs

- [The spec](../../../../docs/specs/0001-ai-knowledge-base/index.md), ten acceptance criteria and the build plan
- [The rationale](../../../../docs/specs/0001-ai-knowledge-base/rationale.md), why local embeddings and pgvector won

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
