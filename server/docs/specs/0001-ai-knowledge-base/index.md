# 0001. Knowledge base for the AI triage pipeline

**Date**: 2026-09-24
**Status**: In Progress

## Summary

Adds an admin managed knowledge base that is scoped to one organization. Admins write articles or upload txt, md, PDF, and Word files, and the server converts them to markdown, splits them into small chunks, and embeds each chunk with a small open source model that runs locally in Node. The chunks live in the existing Postgres database using the pgvector extension. The AI reads this knowledge when it drafts replies to comments and when it triages new tickets, so it answers from facts the org provides. Suggested replies are drafts only, never posted automatically.

## Requirements

**User stories**:
- As an org admin, I want to add and edit knowledge articles so the AI has accurate facts to answer from.
- As an org admin, I want to upload PDF and Word documents so existing SOPs go in without rewriting them.
- As a support agent, I want an AI suggested reply for a comment so I can answer fast from the knowledge base.
- As an organization, I want my knowledge isolated from other orgs so our content never crosses tenants.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: Org admins can create, edit, and delete knowledge articles carrying a title, body, tags, and source type.
- **AC-2**: Org admins can upload txt, md, PDF, and docx files that become articles with extracted markdown.
- **AC-3**: Oversized uploads, unsupported file types, scanned PDFs with no text layer, password protected documents, and legacy doc files fail with a clear message and create nothing.
- **AC-4**: On save or upload the article is chunked and embedded synchronously, so search within the org works immediately.
- **AC-5**: Retrieval is org scoped. A retrieval for one org never returns another org's chunks.
- **AC-6**: The AI triage agent can call `search_knowledge` and receive the top K relevant chunks as grounded context.
- **AC-7**: A signed in org member who can access a ticket can request a suggested reply for one of its comments. The suggestion is a draft only, never persisted or auto posted.
- **AC-8**: Suggested replies are grounded in retrieved knowledge and must decline to answer when nothing relevant matches.
- **AC-9**: When embeddings are unavailable, retrieval falls back to tag and keyword matching instead of failing or guessing.
- **AC-10**: Ingestion and retrieval are logged, including which chunks drove a suggestion, for audit.

## Decision

**Chosen option**: An org scoped knowledge base with local open source embeddings and pgvector search, wired into the triage agent and a new draft comment reply endpoint.

Store admin articles and extracted file text as chunks, embed each chunk locally with a small open source Transformer.js model, search them with the Postgres vector extension, and feed the top matches to the AI as fenced context. The reply endpoint returns a draft for a human to review and post.

**Implementation skills**: `prisma-cli` (`prisma-cli`, `server/.claude/skills/prisma-cli/`) · `prisma-client-api` (`prisma-client-api`, `server/.claude/skills/prisma-client-api/`)

## Feature design

**Data model sketch**:

`KnowledgeArticle`
- `id` String uuid PK
- `orgId` String, required, indexed
- `title` String, required
- `body` String, required, the markdown source
- `source` String enum, one of `article`, `file`, `url`, `video`
- `sourceUrl` String, nullable
- `fileName` String, nullable
- `fileType` String, nullable
- `fileSize` Int, nullable
- `tags` String[]
- `createdAt`, `updatedAt`

`KnowledgeChunk`
- `id` String uuid PK
- `articleId` String FK to `KnowledgeArticle`, `onDelete: Cascade`, indexed
- `index` Int
- `body` String
- `embedding` Unsupported `vector(384)`

The `embedding` column uses the Postgres vector type from the pgvector extension, declared to Prisma as `Unsupported("vector(384)")`. Prisma cannot write or read an unsupported column through the typed client, so chunk insert and similarity search go through raw SQL (`$executeRaw` for insert with a vector literal parameter, `$queryRaw` for similarity with the near operator). Reads that do not touch the embedding column, such as listing chunks for the admin editor, use normal Prisma selects.

No state machine. An article edit or file re upload means delete its chunks and ingest again, done in one transaction.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/kb/articles` | GET | none | article list, org scoped | org admin | 401, 403 |
| `/api/kb/articles` | POST | title, body, source, sourceUrl?, tags[] | created article with chunks ingested | org admin | 400, 401, 403 |
| `/api/kb/articles/:id` | PATCH | any editable field | updated article, chunks replaced | org admin | 400, 401, 403, 404, 409 |
| `/api/kb/articles/:id` | DELETE | none | 204 | org admin | 401, 403, 404 |
| `/api/kb/upload` | POST | file (multipart, multer) | created article from file | org admin | 413, 415, 422, 401, 403 |
| `/api/ai/comments/:commentId/reply` | POST | none | `{ draftReply, citations, kind }` | signed in member with ticket access | 401, 403, 404 |

The KB routes sit behind `requireAuth` plus `assertUserIsAdminInOrganization`, the same helper the assign flow uses. The reply route sits behind `requireAuth` plus `assertCanAccessTicket`, and is rate limited like the other comment writes.

**Value sourcing** (every produced value names where it comes from):

| Action | Value produced or displayed | Source |
|---|---|---|
| Create article | `title`, `body`, `source`, `sourceUrl`, `tags` | request body |
| Create or edit article | `orgId` | session org from Clerk (`getAuth`) |
| Edit article | re ingestion rule | every successful `PATCH` replaces all chunks in the same transaction |
| Upload file | `title` | sanitized original file name without its final extension |
| Upload file | `tags` | empty array |
| Upload file | `source` | `file` enum value |
| Upload file | `body` markdown | extracted text: `pdf-parse`, `mammoth` to HTML, `turndown` to markdown; `.txt` and `.md` pass through |
| Upload file | `fileName`, `fileType`, `fileSize` | multer file metadata |
| Upload file | extracted text length guard | `KB_MAX_TEXT_CHARS` |
| Suggest reply | `draftReply` | LLM over retrieved chunks, generated by the reply agent |
| Suggest reply | `citations` | chunk ids and article titles from the retriever |
| Suggest reply | `orgId` | ticket row's `orgId`, must match session org |
| Suggest reply | `kind` | branch taken: model, fallback, or disabled |
| Triage `search_knowledge` | `orgId` | request `orgId` from the triage input |
| Retrieval | fallback on no embedder | tag and keyword match over article `tags`, `title`, `body` |

**Key invariants**:
- Every article has a non null `orgId`; chunks inherit the article org.
- Every retrieval filters by `orgId`. No cross tenant read path exists.
- The reply endpoint never persists. It returns a draft the caller posts.
- Deleting an article deletes its chunks through the FK cascade.
- Editing an article or uploading a replacement replaces its chunks in one transaction (delete all, insert new), so search never shows half old half new content.
- Concurrent article edits use the row's `updatedAt` as a compare and swap guard, so the second writer gets 409 instead of pairing new metadata with stale chunks.
- Uploaded document text passes through `sanitizeText`, is capped by `KB_MAX_TEXT_CHARS`, and is capped at a max chunk count per article.
- The embedding dimension is fixed at 384 and must match the vector column, set by config.
- The triage create agent still never assigns a ticket. Assignment is out of scope for this spec.

**Security model**:
- Knowledge management: org admin role only, enforced by `assertUserIsAdminInOrganization` (Clerk basic role `admin` or `org:admin`).
- Suggest reply: any signed in org member who passes `assertCanAccessTicket`, rate limited the same as comment writes.
- Prompt injection containment: uploaded text and retrieved chunks are fenced as data, never embedded as instructions. Both pass through `sanitizeText`, and the reply instructions tell the model the context is data.
- No payments, PII, or health data is stored beyond the documents an admin chooses to upload. Org scoping is the intended isolation; admins still decide what to publish. No additional compliance scope applies.

**Configuration required**:
- `AI_EMBEDDING_MODEL`: local embedding model id, default `Xenova/all-MiniLM-L6-v2`
- `AI_EMBEDDING_DIM`: vector dimensions, default `384`
- `AI_EMBEDDING_TOP_K`: chunks returned per query, default `5`
- `AI_EMBEDDING_CACHE_DIR`: model weight cache directory, optional
- `KB_MAX_UPLOAD_BYTES`: per file cap, default 10 MB
- `KB_MAX_TEXT_CHARS`: extracted document text cap, default 1,000,000 characters

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path upload: an admin uploads a PDF; the article exists with markdown, chunks are embedded synchronously, triage retrieves them, and the reply endpoint returns a grounded draft, verifies **AC-2**, **AC-4**, **AC-6**, **AC-7**
- Org isolation: org A uploads an article; a reply request on an org B ticket must never include org A chunks, verifies **AC-5**
- Bad inputs: scanned PDF, password protected PDF, legacy doc, oversized file, wrong extension each return a clear 4xx and create nothing, verifies **AC-3**
- Embedder down: retrieval still returns tag matches; the reply agent prefers a decline over a guess, verifies **AC-8**, **AC-9**
- Empty knowledge: a reply request with no relevant match returns a draft that says it cannot verify, verifies **AC-8**
- Permissions: a non admin KB write is rejected, verifies **AC-1**
- Audit: every suggestion logs the chunk ids used, verifies **AC-10**

## Migration plan

**Strategy**: additive only, no existing data is transformed.
**Phases**:
1. Run the raw SQL that enables the pgvector extension and creates the HNSW index on `KnowledgeChunk`. Run against the direct connection URL in `prisma7.config.ts`.
2. Add the two Prisma models and `prisma db push`.
3. Deploy the server and client code.
**Rollback**: drop the two tables and revert the code commit. The extension and index can stay.
**Risks**: pgvector must be available on the hosted Postgres instance. Verify with `CREATE EXTENSION` before deployment. Prisma `db push` cannot create the vector type, so the raw SQL file is required and clearly documented.

## Build plan

Build approach: none recorded in this repo, so the plan defaults to thin end to end slices through every layer. The data model is the coherent target; its migration lands in slice 1.

1. [x] Enable pgvector with raw SQL and add the `KnowledgeArticle` and `KnowledgeChunk` models, then `prisma db push`, satisfies **AC-1**, **AC-5** (migration applied and verified live; `KnowledgeChunk.embedding` is `vector(384)` with the HNSW index present)
2. [x] Build the chunker and the local embedder with `node --test` unit tests, satisfies **AC-4**, **AC-9** (chunker and embedder landed with passing unit tests; embedder degrades gracefully when the model download fails, which is the fallback hook)
3. [x] Build the knowledge service and the retriever (cosine similarity with a tag fallback), satisfies **AC-4**, **AC-5**, **AC-9** (service ingests within a transaction; retriever verified live against the real pgvector column with org scoping)
4. [x] Build the KB admin routes, controllers, and validators, including the multer upload path with the extraction and failure handling, satisfies **AC-1**, **AC-2**, **AC-3** (org admin guard, in memory multer with a byte cap, extraction before any database write, atomic article and chunk writes, and a 409 guard on concurrent edits)
5. Build `search_knowledge` and add it to the create agent toolset, satisfies **AC-6**
6. Build the reply agent and the `POST /api/ai/comments/:commentId/reply` endpoint, satisfies **AC-7**, **AC-8**
7. Build the client: the admin knowledge base page (article editor, upload, delete) and the suggest reply button in the conversation tab, satisfies **AC-1**, **AC-7**
8. Add structured logging for ingestion and retrieval, the new env vars to `.env.example`, the README section, and the verify script, satisfies **AC-10**

## Consequences

**Positive**:
- The AI answers from facts the org owns, with no per embedding token cost and no data egress to an embedding vendor.
- Reply suggestions stay drafts, so a human keeps control of what ships to customers.
- Uploads accept the formats support teams already have (PDF, Word) instead of forcing markdown.

**Negative or tradeoffs**:
- The vector column forces raw SQL for chunk writes and similarity reads, split away from the typed Prisma client.
- Document extraction quality varies widely. Scanned PDFs and complex layouts need manual text, and bad extractions surface as upload failures, not silent knowledge.
- The local model adds memory and a first call warm up cost to the server, and its weights download on first use unless cached ahead.
- Org scoping is not a permission boundary for document content. An admin who uploads secrets still exposes them to that org's AI.

**Neutral**:
- The pgvector extension is a new dependency on the hosted database.
- New env vars gate embedding behavior.
- No scope feature row exists yet for this spec; a follow-up offers to enroll one.

## Follow-up

- [ ] Enroll a scope feature for this spec in its ready to build shape, since no matching scope row exists today.
- [ ] Automatic URL import and YouTube transcript import later. The `url` and `video` source values and `sourceUrl` field are ready; the importers are not.
- [ ] OCR for scanned PDFs (for example `tesseract.js`) if image only documents turn out to be common.
- [ ] A multilingual embedding model (for example `multilingual-e5-small`) if non English content matters. It is a one line config change.
- [ ] No `AGENTS.md` exists in this repo. Write a root one that records server and client conventions and points at the installed prisma skills before implementation starts.

## Rationale

Reasoning and options: see `rationale.md`.