# Scope

**Build approach:** Tracer Bullet (build a thin end to end slice first, then expand).
**Workflow:** Alpha (runs /check verify after develop).

## At a glance

| Feature | Status | Spec | Latest |
|---|---|---|---|
| Knowledge base for the AI triage pipeline | in-progress | [0001](../specs/0001-ai-knowledge-base/index.md) | 2026-09-25 |
| Omnichannel ticket intake | in-progress | [0002](../specs/0002-omnichannel-ticket-intake.md) | 2026-10-01 |

## Features

### Knowledge base for the AI triage pipeline

Intent: give the AI an admin managed, org scoped knowledge source it can answer from when it drafts comment replies and triages tickets. Admins write articles or upload txt, md, PDF, and Word files that become locally embedded chunks searched with pgvector.

Done when: admins can manage articles and uploads, retrieval is org scoped, the triage agent reads knowledge, and a signed in member gets draft reply suggestions that are grounded in retrieved facts and never auto post.

Code in: `server/prisma/schema.prisma`, `server/prisma/sql/`, `server/src/utils/fileFormats.js`, `server/src/routes/kb.js`, `server/src/controllers/kb.js`, `server/src/validators/kbSchemas.js`, `server/src/middleware/kbUpload.js`, `server/src/middleware/requireKnowledgeAdmin.js`, `server/src/config/knowledge.js`, `server/src/ai/knowledge/knowledgeService.js`

- [x] Design it (spec), links [0001](../specs/0001-ai-knowledge-base/index.md)
- [ ] Build it: /develop ai-knowledge-base
  - [x] Slice 1: Prisma models plus pgvector migration, satisfies AC-1, AC-5
  - [x] Slice 2: chunker, embedder, and retriever with tag fallback, satisfies AC-4, AC-5, AC-9
  - [x] Slice 3: KB admin API and uploads with extraction and failure handling (2026-09-25), satisfies AC-1, AC-2, AC-3
  - [ ] Slice 4: search_knowledge tool and the comment reply draft endpoint, satisfies AC-6, AC-7, AC-8
  - [ ] Slice 5: admin knowledge base page, suggest reply button, and logging, satisfies AC-1, AC-7, AC-10
- [ ] Verify it: /check verify ai-knowledge-base
- [ ] Test it: /test ai-knowledge-base

## Phase 2: Omnichannel intake

### 2. Omnichannel ticket intake

Intent: let users send in tickets from email and Telegram. Messages become tickets in the same pipeline, with the same triage and knowledge base grounding.

Done when: an email or Telegram message creates a ticket, the sender is identified and linked, and the ticket flows through the same triage and reply pipeline as web created tickets.

- [x] Design it (spec), links [0002](../specs/0002-omnichannel-ticket-intake.md)
- [ ] Build it: /develop omnichannel-ticket-intake
  - [ ] Slice 1: Email end to end (data model, webhook, SMTP integration, reply dispatch), satisfies AC-1, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-10
  - [ ] Slice 2: Telegram end to end (webhook, reply dispatch), satisfies AC-2, AC-3, AC-4, AC-6, AC-7, AC-9
  - [ ] Slice 3: Channel management (CRUD endpoints, admin UI), satisfies AC-8
- [ ] Verify it: /check verify omnichannel-ticket-intake

## Deferred

- [ ] Omnichannel intake: consider moving to the async PgBoss architecture (from AI_LAYER_PLAN.md) when message volume grows
- [ ] Omnichannel intake: consider cross channel sender linking as a v2 feature
- [ ] Omnichannel intake: consider attachment support as a v2 feature
- [ ] Omnichannel intake: consider a retry mechanism for failed IngestionEvents as a v2 feature