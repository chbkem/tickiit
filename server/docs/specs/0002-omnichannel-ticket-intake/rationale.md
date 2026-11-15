# 0002. Omnichannel ticket intake — rationale

## Context

The ticketing dashboard currently creates tickets only through the web UI. Customers who prefer email or Telegram have no way to submit a ticket; they must use the web form. The existing `POST /api/ai/triage` endpoint already runs the full triage pipeline and always creates a ticket, degrading to deterministic defaults when the AI is unavailable. The `Ticket.source` field already stores a channel string. The `AI_LAYER_PLAN.md` describes a future async architecture with PgBoss (a Postgres based job queue) and an `IngestionEvent` table, but almost none of it is built. The knowledge base (spec 0001) is part built and will ground triage once its `search_knowledge` tool lands.

The feature must reuse the existing triage pipeline, not build a parallel one. It must identify senders across repeat messages without a Customer table. It must dispatch agent replies back to the customer's channel. And it must be idempotent (safe to retry), because webhook providers retry deliveries.

## Options considered

### Option 1: Synchronous pipeline reuse

Reuse the existing synchronous `runTriage` pipeline. The webhook endpoint validates the input, deduplicates via IngestionEvent, calls `runTriage` inline, and returns 200 OK. Reply dispatch happens synchronously in the comment creation flow.

**Pros**:
- Reuses the existing pipeline exactly; no parallel code path.
- The pipeline always creates a ticket (degradation contract), so no message is lost.
- Simplest to build and operate; no queue infrastructure.

**Cons**:
- The webhook request blocks until the triage completes (including AI calls), so latency is higher.
- No retry mechanism if the triage fails after the dedup record is created.

### Option 2: Async queue with PgBoss

Add the message to a PgBoss queue and process it in a background worker, as described in `AI_LAYER_PLAN.md`.

**Pros**:
- The webhook returns immediately; triage runs in the background.
- Built in retries and dead letter queue.

**Cons**:
- PgBoss is not built; it is a significant new infrastructure component.
- The `AI_LAYER_PLAN.md` is almost entirely unbuilt; building it for this feature is scope creep.
- More moving parts to operate and debug.

## Rationale

The existing `POST /api/ai/triage` endpoint already does exactly what the feature needs: it runs the triage pipeline and always creates a ticket. The pipeline is channel agnostic (it reads `channel` from the input and stores it in `Ticket.source`). The `identity.js` module already resolves a requester ref to a Clerk user or derives a stable customer key. Reusing this pipeline means no parallel code path to maintain and no new failure modes.

The async PgBoss architecture in `AI_LAYER_PLAN.md` is the right long term design, but it is almost entirely unbuilt. Building it for this feature would mean introducing a queue, a worker process, and a new database schema before a single ticket is created. The synchronous path delivers the feature with the infrastructure that exists today.

The tradeoff is accepted: the webhook blocks until triage completes, and a triage failure after the dedup record is created loses the message. Both are rare (the pipeline always creates a ticket by design), and both can be addressed later by moving to the async architecture.
