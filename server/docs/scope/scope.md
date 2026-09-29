# Scope

## At a glance

| Feature | Status | Spec | Latest |
|---|---|---|---|
| Knowledge base for the AI triage pipeline | in-progress | [0001](../specs/0001-ai-knowledge-base/index.md) | 2026-09-24 |

## Features

### Knowledge base for the AI triage pipeline

Intent: give the AI an admin managed, org scoped knowledge source it can answer from when it drafts comment replies and triages tickets. Admins write articles or upload txt, md, PDF, and Word files that become locally embedded chunks searched with pgvector.

Done when: admins can manage articles and uploads, retrieval is org scoped, the triage agent reads knowledge, and a signed in member gets draft reply suggestions that are grounded in retrieved facts and never auto post.

Code in: `server/prisma/schema.prisma`, `server/prisma/sql/`, `server/src/utils/fileFormats.js`

- [x] Design it (spec), links [0001](../specs/0001-ai-knowledge-base/index.md)
- [ ] Build it: /develop ai-knowledge-base
  - [x] Slice 1: Prisma models plus pgvector migration, satisfies AC-1, AC-5
  - [ ] Slice 2: chunker, embedder, and retriever with tag fallback, satisfies AC-4, AC-5, AC-9
  - [ ] Slice 3: KB admin API and uploads with extraction and failure handling, satisfies AC-1, AC-2, AC-3
  - [ ] Slice 4: search_knowledge tool and the comment reply draft endpoint, satisfies AC-6, AC-7, AC-8
  - [ ] Slice 5: admin knowledge base page, suggest reply button, and logging, satisfies AC-1, AC-7, AC-10
- [ ] Verify it: /check verify ai-knowledge-base
- [ ] Test it: /test ai-knowledge-base