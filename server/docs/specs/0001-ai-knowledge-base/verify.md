# 0001. Knowledge base for the AI triage pipeline, verify

End to end proof for the spec. Run against a dev server with a real database and the debugging key config in place. Each step names the acceptance criterion it proves.

## Prerequisites

- Postgres with the pgvector extension enabled (the migration SQL ran).
- `.env` has `AI_EMBEDDING_MODEL`, `AI_EMBEDDING_DIM=384`, and a Google API key for Gemini.
- Two Clerk orgs exist with an admin member in each, for the isolation check.

## Automated suite

1. Run `npm test` in `server`. The chunker, embedder, and retriever unit tests pass, including the tag fallback path, proves **AC-4**, **AC-9**.

## Manual flows

2. Upload a txt and md file, then a docx and PDF, as an org admin. Each returns an article with markdown in the body, proves **AC-2**.
3. Edit an article's body. Confirm the chunk list reflects the new text only (old chunks replaced), proves **AC-4**, confirmed by the logs.
4. Upload a scanned PDF, a password protected PDF, a legacy `.doc`, a 12 MB file, and a `.exe`. Each returns a clear error and no article row appears, proves **AC-3**.
5. Send a triage request for org A. Inspect the tool trace and confirm `search_knowledge` returned chunks that belong to org A only, proves **AC-5**, **AC-6**, **AC-10**.
6. As a non admin member, request a reply on a comment. It is rejected with 403, proves **AC-7**.
7. As an admin, request a reply on a comment for a topic that exists in the KB. The draft echoes the retrieved facts and lists citations, proves **AC-7**, **AC-8**.
8. Request a reply for a topic with no KB match. The draft declines to answer rather than guessing, proves **AC-8**.
9. Point `AI_EMBEDDING_MODEL` at an invalid id so the embedder fails. Retrieval still returns tag matches and the reply keeps a decline rule, proves **AC-9**.
10. As org B, request a reply on one of org B's tickets for a topic that exists only in org A. Confirm no org A chunk appears in the citations, proves **AC-5**.
11. Delete an article. The article and its chunks disappear, proof for **AC-1**.
12. Confirm every suggestion and upload appears in the structured log with chunk ids, proves **AC-10**.

## Slice 1: schema and extraction foundations, updated 2026-09-24

- [ ] Query the live database (DIRECT_URL): `KnowledgeArticle`, `KnowledgeChunk`, and the `KnowledgeSource` enum exist; `KnowledgeChunk.embedding` is type `vector`; the `KnowledgeChunk_embedding_idx` HNSW index is present, proves **AC-1**, **AC-5**.
- [ ] `node --test src/utils/fileFormats.test.js` passes. Covers txt and md pass through, a PDF with a text layer extracting, and a scanned PDF, password protected PDF, legacy `.doc`, unsupported extension, and mime mismatch each failing with its clear message, proves **AC-2**, **AC-3**.
- [ ] As an org admin, upload a PDF and a docx (run end to end once the upload route from Slice 3 exists). Each returns an article whose body holds the extracted markdown, proves **AC-2**.