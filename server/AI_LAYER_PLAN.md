# AI Layer — Implementation Plan

Custom agent runtime (built from scratch to study AI engineering: **agent loop, tools, memory, provider abstraction, structured outputs, deterministic fallback**) fed by a **PgBoss** queue, applying verified decisions through the existing ticket service with a confidence gate and circuit-breaker safety.

## Architecture

```
           ┌────────────────────────────────────────────────────────────┐
           │  POST /api/ai/ingest  (channel adapter / webhook)         │
           │  { channel, externalId, raw, requesterRef, orgId? }       │
           └──────────────┬─────────────────────────────────────────────┘
                          ▼
              zod validate + sanitizeText (untrusted input)
                          ▼
        upsert IngestionEvent (unique [channel, externalId])
                          ▼
     PgBoss receive 'ingest.triage'  (singletonKey, exclusive = exactly-once)
                          ▼
     ┌──────────────── worker.js ────────────────┐
     │ normalize → enrich → contextAssembly      │
     │ → AgentRuntime (tools + memory → draft)   │
     │ → finalize + Decider.validate (zod)       │
     │ → confidence gate → circuit breaker       │
     │ → apply persists via ticketService        │
     │  (source=channel)                         │
     │ → TicketInsight (trace) → update event    │
     └──────────────────┬────────────────────────┘
                        ▼
         Reviewer queue: ingest?aiReviewRequired=true
         (below confidence threshold or breaker OPEN)
```

## Key components

### 1. Providers (`src/ai/providers/`)
- `AiProvider` interface: `chat({ messages, tools, responseFormat })` → choices + usage.
- `OpenAICompatibleProvider` — plain `fetch`, env-configured (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`). Compatible with OpenAI, Azure, Anthropic gateways, Groq, Mistral, Together, Ollama, LM Studio, vLLM (OpenAI wire protocol).
- `FallbackDeterministicProvider` — same interface, keyword/regex heuristics. Runs the whole agent fully offline when `AI_ENABLED=false`; also backs failed or under-threshold decisions.

### 2. Agent core (`src/ai/agent/`)
- `AgentRuntime` — ReAct-style loop (`TriageAgent`), bounded by `AI_AGENT_MAX_TURNS`. The model acts as the builder: it uses read tools to gather context, then **`create_ticket` returns a zod-validated draft** and **`finalize` submits the structured decision** (confidence + rationale). Writes are never persisted inside the loop — the `apply` stage owns the DB write. This keeps prompt-injection blast radius capped (raw channel text is fenced as data, tool args are closed-world).
- `ToolRegistry` — zod-schematized tools bound to existing services:
  - `get_requester_context` → resolve Clerk user + their recent tickets
  - `search_knowledge` → KB article hits via context assembler
  - `list_assignable_agents` → Clerk org roles (exclude requester) + ranked by open-ticket workload
  - `get_org_policy` → org SLA/config targets
  - `create_ticket(ticketDraft)` → **draft-only, schema-fenced**: closed-world enums (types/priorities from `constants/ticket`, agents only from the returned pool, no status/delete); returns a validated draft payload, does not persist
  - `finalize(decision)` → structured confirmation: subject/type/priority/assigneeRef/draftId, confidence, rationale
- Memory:
  - Short-term: task message buffer with token budget (`AI_MAX_CONTEXT_TOKENS`).
  - Long-term: `AgentMemory` table (facts keyed by org/scope) + requester ticket history + KB.
  - **Phase 2**: pgvector semantic retrieval behind the same `KnowledgeRetriever` interface.
- `Decider` — validates LLM JSON against zod `TriageDecision`; one repair turn on failure, else deterministic fallback.

### 3. Ingestion + queue (PgBoss)
- `POST /api/ai/ingest` → zod + sanitize → upsert `IngestionEvent` (status `PENDING`, unique `(channel, externalId)`) → `boss.send('ingest.triage', payload, { singletonKey: 'channel:externalId', policy: 'exclusive' })` → exactly-once dedup (PG SKIP LOCKED).
- Queue `ingest.triage` with retries/backoff; poisoned jobs go to a dead-letter queue.
- Worker runs in separate `src/worker.js` entry (`npm run worker`), same package, shares `src/lib`, can scale independently later.
- **PgBoss connection must use `DIRECT_URL`** (port 5432). `DATABASE_URL` goes through Supabase pgbouncer transaction pooling; PgBoss needs direct DDL + advisory locks for its schema migrations.

### 4. Pipeline (worker)
```
normalize raw input            → subject/body/requesterRef, attachments quarantined
enrich                         → requester profile + recent tickets, org, KB hits, agent pool, policy
contextAssembly                → budgeted system/user context (token cap)
AgentRuntime                   → loop w/ tools + memory: reads context,
                                 create_ticket(draft) → finalize(decision)
Decider.validate               → zod re-validates draft + decision, one repair attempt
confidence gate                → above AI_CONFIDENCE_THRESHOLD → auto-apply
                                 below → aiReviewRequired=true, suggestions stored
circuit breaker                → provider errors/timeouts trip → REVIEW mode
apply                          → ticketService.createTicket (source=channel, system account)
TicketInsight                  → persist decision, toolTrace, rawOutput, usage
update IngestionEvent          → PROCESSED / REVIEW / FAILED
```

## Guardrails (phase 1)
- **Prompt-injection containment** — input is delimited data, never embedded into privileged instructions. Write tools exist but are **draft-only + schema-fenced** (closed-world enums, no destructive tools); the `apply` stage owns persistence, so a misused tool can at worst produce a badly-worded draft — never an unvalidated write.
- **Circuit breaker → review mode** — repeated provider failures/timeouts trip an in-process breaker; incoming events park as `REVIEW` with the deterministic fallback decision stored in `TicketInsight` for human review, instead of silently auto-applying or dropping. Auto-resets after cooldown; manual reset via admin endpoint.
- **Egress redaction** — PII/attachments quarantined before any model request (critical under BYOM).
- **Confidence gate** — auto-apply above `AI_CONFIDENCE_THRESHOLD`; below → review.
- **Idempotency** — PgBoss singleton + unique `(channel, externalId)` event constraint.
- All untrusted input sanitized via existing `sanitizeText`; writes enforce org scoping + existing admin-role rules internally (worker acts as a system account, bypassing the Clerk session).

## Observability (phase 1)
- **Correlated logging** — every pipeline stage logs under `ingestionEventId` / `ticketId` (winston JSON + secret redaction in prod).
- **Persisted traces** — `TicketInsight.rawOutput` + `toolTrace`, token usage, model/provider. Doubles as human-review trail and future eval seed.
- **Phase 2** (deferred): dashboards/alerting, evals suite, cost/budget dashboards, semantic memory analytics.

## Schema additions (Prisma)

```prisma
model IngestionEvent {
  id              String        @id @default(uuid())
  channel         String
  externalId      String
  orgId           String?
  requesterRef    String?
  rawPayload      Json
  status          IngestStatus  @default(PENDING)
  aiReviewRequired Boolean      @default(false)
  attempts        Int           @default(0)
  error           String?
  ticketId        String?
  processedAt     DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([channel, externalId])
}

model TicketInsight {
  id           String         @id @default(uuid())
  ticketId     String         @unique
  subject      String?
  type         TicketType
  priority     Priority
  assigneeId   String?
  confidence   Json
  model        String?
  provider     String?
  rawOutput    Json
  toolTrace    Json
  createdAt    DateTime       @default(now())
}

model KnowledgeArticle {
  id       String    @id @default(uuid())
  orgId    String?   // null = global
  title    String
  body     String
  tags     String[]
  source   String
  embedding Json?    // phase 2: pgvector via raw migration + Unsupported("vector")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AgentMemory {
  id        String   @id @default(uuid())
  orgId     String
  scope     String   // requester | org | ticket
  scopeKey  String
  factKey   String
  value     Json
  confidence Float?
  embedding Json?    // phase 2: pgvector
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([orgId, scope, scopeKey, factKey])
}

enum IngestStatus {
  PENDING
  PROCESSING
  PROCESSED
  REVIEW
  FAILED
}
```

- PgBoss creates its own `pgboss` schema automatically on `start()`.

## Routes & validators (existing conventions)
- `src/routes/ingestion.js`
  - `POST /api/ai/ingest` — machine token `AI_INGEST_TOKEN` (per-org channel keys later with omnichannel)
  - admin: list events, `POST /api/ai/ingest/:id/retry`
- `src/routes/aiAdmin.js` — `requireAuth` + admin check
  - `KnowledgeArticle` CRUD
  - `GET /api/ai/insights` (review queue)
  - `POST /api/ai/dry-run` (synchronous pipeline trace, no writes)
- `src/validators/ingestionSchemas.js` — zod, existing style, reuse `sanitizeText`.

## Environment additions (`.env` / `.env.example`)
```
AI_ENABLED=true
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_MODEL=
AI_AGENT_MAX_TURNS=3
AI_MAX_CONTEXT_TOKENS=4000
AI_CONFIDENCE_THRESHOLD=0.7
AI_TIMEOUT_MS=15000
AI_INGEST_TOKEN=
AI_FALLBACK_MODE=review           # review | deterministic
PGBOSS_CONNECTION_STRING=         # defaults to DIRECT_URL
# phase 2: AI_EMBEDDING_MODEL=
```

## File layout
```
src/ai/
  providers/
    aiProvider.js            # AiProvider interface
    openaiCompatible.js      # HTTP provider
    fallbackEngine.js        # deterministic no-LLM provider
  contracts/
    triageDecision.js        # zod decision + confidence schemas
  agent/
    runtime.js               # ReAct loop, tracing
    tools/
      registry.js
      requesterContext.js    # Clerk user + recent tickets
      knowledgeSearch.js     # KB context assembler
      agentPool.js           # Clerk org roles + workload
      orgPolicy.js
      createTicket.js        # draft-only, schema-fenced (apply persists)
      finalize.js            # structured decision: confidence + rationale
    memory/
      buffer.js              # short-term token-budgeted window
      memoryStore.js         # AgentMemory long-term store
    decider.js               # validation + repair + fallback
  knowledge/
    retriever.js             # interface (context assembly now, pgvector later)
    knowledgeService.js      # KnowledgeArticle CRUD
  pipeline/
    normalize.js
    enrich.js
    contextAssembly.js
    apply.js
    runner.js                # job handler: stages + gates + breaker
  circuitBreaker.js
src/worker.js                # node src/worker.js (PgBoss worker)
src/controllers/ingestion.js
src/controllers/aiAdmin.js
src/routes/ingestion.js
src/routes/aiAdmin.js
src/validators/ingestionSchemas.js
prisma/schema.prisma         # + IngestionEvent, TicketInsight, KnowledgeArticle, AgentMemory
```

## Build order
1. Prisma models + `prisma db push`; install `pg-boss`
2. Provider layer + fallback engine + zod `TriageDecision` contract (pure, `node --test` unit-tested)
3. Agent runtime: loop, ToolRegistry (incl. create_ticket + finalize), memory buffer, tracing
4. Tools + context assembler (requester, KB, agent pool, policy)
5. `KnowledgeArticle` CRUD + admin routes
6. Ingest route + `IngestionEvent` + PgBoss enqueue; worker handler with **confidence gate + circuit breaker + apply**
7. Dry-run + review/retry endpoints; wire routes into `src/index.js`; add `worker` script + `AI_*` env to `.env.example`
8. README section: BYOM setup, security, data egress
9. Verify: server + worker up, dry-run + live ingest via curl; `node --test` units

## Deferred to phase 2
- pgvector RAG (semantic KB retrieval + semantic memory)
- Evals suite (historical-ticket regression dataset)
- Dashboards/alerting, cost/budget UI
- Per-org channel keys / webhook sync for `AgentProfile` skills