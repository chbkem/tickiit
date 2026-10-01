# 0002. Omnichannel ticket intake

**Date**: 2026-10-01
**Status**: Proposed

## Summary

Adds email and Telegram as inbound ticket channels. A customer sends an email or a Telegram message, and the server creates a ticket through the same triage pipeline (the normalize, classify, prioritize, create sequence) that web created tickets use. The sender is identified by email address or Telegram user id and linked to a Clerk user or a stable customer key. When an agent replies from the dashboard, the reply is sent back to the customer's channel, and admins manage channels through CRUD (create, read, update, delete) endpoints.

## Context

The ticketing dashboard currently creates tickets only through the web UI. Customers who prefer email or Telegram have no way to submit a ticket; they must use the web form. The existing `POST /api/ai/triage` endpoint already runs the full triage pipeline and always creates a ticket, degrading to deterministic defaults when the AI is unavailable. The `Ticket.source` field already stores a channel string. The `AI_LAYER_PLAN.md` describes a future async architecture with PgBoss (a Postgres based job queue) and an `IngestionEvent` table, but almost none of it is built. The knowledge base (spec 0001) is part built and will ground triage once its `search_knowledge` tool lands.

The feature must reuse the existing triage pipeline, not build a parallel one. It must identify senders across repeat messages without a Customer table. It must dispatch agent replies back to the customer's channel. And it must be idempotent (safe to retry), because webhook providers retry deliveries.

## Requirements

**User stories**:
- As a customer, I want to send an email or Telegram message so that I get support without using the web form.
- As an agent, I want channel tickets to appear in the same dashboard queue so that I can reply from one place.
- As an agent, I want my reply to reach the customer on their original channel so that the customer gets the answer where they asked.
- As an org admin, I want to manage which email addresses and Telegram bots belong to my org so that I control the intake endpoints.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: An inbound email creates a ticket via the triage pipeline, with `source` set to "EMAIL" and the sender identified.
- **AC-2**: An inbound Telegram text message creates a ticket via the triage pipeline, with `source` set to "TELEGRAM" and the sender identified.
- **AC-3**: The sender is identified by email address (for email) or Telegram user id (for Telegram) and linked to a Clerk user (via externalId) or a stable customer key (derived hash).
- **AC-4**: An agent reply on a channel ticket is dispatched back to the customer's channel (email via nodemailer, a Node.js email library; Telegram via the Bot API, Telegram's HTTP API for bots).
- **AC-5**: Duplicate webhook deliveries are ignored (idempotent via IngestionEvent unique constraint).
- **AC-6**: Each channel endpoint (email address or Telegram bot) maps to exactly one org.
- **AC-7**: Channel tickets flow through the same triage and reply pipeline as web created tickets (same `runTriage`, same comment flow).
- **AC-8**: Org admins can create, list, update, and delete channels.
- **AC-9**: Non-text Telegram messages (photos, stickers, documents) are ignored and create no ticket.
- **AC-10**: Inbound email reads plain text only; HTML content is not parsed.

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

## Decision

**Chosen option**: Option 1: Synchronous pipeline reuse.

The feature reuses the existing synchronous `runTriage` pipeline. Webhook endpoints validate, deduplicate, and call `runTriage` inline. Reply dispatch happens synchronously in the comment creation flow. This is the simplest path that delivers the feature without building new infrastructure.

**Implementation skills**: `prisma-client-api` (`prisma/prisma`, `.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/prisma`, `.agents/skills/prisma-cli/`)

## Rationale

The existing `POST /api/ai/triage` endpoint already does exactly what the feature needs: it runs the triage pipeline and always creates a ticket. The pipeline is channel agnostic (it reads `channel` from the input and stores it in `Ticket.source`). The `identity.js` module already resolves a requester ref to a Clerk user or derives a stable customer key. Reusing this pipeline means no parallel code path to maintain and no new failure modes.

The async PgBoss architecture in `AI_LAYER_PLAN.md` is the right long term design, but it is almost entirely unbuilt. Building it for this feature would mean introducing a queue, a worker process, and a new database schema before a single ticket is created. The synchronous path delivers the feature with the infrastructure that exists today.

The tradeoff is accepted: the webhook blocks until triage completes, and a triage failure after the dedup record is created loses the message. Both are rare (the pipeline always creates a ticket by design), and both can be addressed later by moving to the async architecture.

## Feature design

**Data model sketch**:

| Entity | Primary key | Fields | Relationships |
|---|---|---|---|
| Channel | id (uuid) | orgId, channel (ChannelType enum: EMAIL, TELEGRAM), identifier, isActive, createdAt, updatedAt | orgId links to an org by string (org identity comes from Clerk) |
| IngestionEvent | id (uuid) | channel, externalId, ticketId (nullable), createdAt | ticketId loosely references Ticket (set after triage) |
| Ticket | id (uuid) | existing fields plus channelRecipient (string, nullable) | source stores the channel; requesterId and requesterKey store the sender; channelRecipient stores the reply to address |
| Comment | id (uuid) | existing fields, no changes | existing FK to Ticket |

Unique constraints:
- Channel: `@@unique([orgId, channel, identifier])`
- IngestionEvent: `@@unique([channel, externalId])`

New enum: `ChannelType { EMAIL, TELEGRAM }`

**State transitions**: No new state machine. Tickets use the existing Status enum (OPEN, IN_PROGRESS, ON_HOLD, RESOLVED, CLOSED). IngestionEvent has no status (it is a dedup record, not a lifecycle entity).

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| /api/channels/email/webhook | POST | from:string (req), subject:string (req), body:string (req), messageId:string (req) | 200 OK | shared secret header | 400 malformed, 401 invalid secret, 409 duplicate |
| /api/channels/telegram/webhook | POST | Telegram Update object (req) | 200 OK | Telegram secret token | 400 malformed, 401 invalid token, 409 duplicate |
| /api/channels | GET | orgId (from session) | Channel[] | org admin | 403 not admin |
| /api/channels | POST | channel:string (req), identifier:string (req) | Channel | org admin | 400 invalid, 403 not admin, 409 duplicate |
| /api/channels/:id | PATCH | isActive:boolean (opt) | Channel | org admin | 403 not admin, 404 not found |
| /api/channels/:id | DELETE | (none) | 204 | org admin | 403 not admin, 404 not found |

Reply dispatch is not a separate endpoint. It happens synchronously in the comment creation flow: after a comment is saved on a channel ticket, the reply is sent to `Ticket.channelRecipient` via the channel's transport (nodemailer for email, Bot API for Telegram).

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Email webhook | orgId | DB lookup: Channel table by identifier (email address) |
| Email webhook | channel | "EMAIL" (decided) |
| Email webhook | externalId | messageId (input param) |
| Email webhook | requesterRef | from (input param) |
| Email webhook | requesterEmail | from (input param) |
| Email webhook | channelRecipient | from (input param) |
| Telegram webhook | orgId | DB lookup: Channel table by identifier (bot username) |
| Telegram webhook | channel | "TELEGRAM" (decided) |
| Telegram webhook | externalId | message.message_id (input param) |
| Telegram webhook | requesterRef | message.from.id (input param) |
| Telegram webhook | requesterName | message.from.first_name + last_name (input param) |
| Telegram webhook | channelRecipient | message.chat.id (input param) |
| Reply dispatch | channel | Ticket.source (DB column) |
| Reply dispatch | channelRecipient | Ticket.channelRecipient (DB column) |
| Reply dispatch | reply text | Comment.body (DB column) |
| Channel CRUD | orgId | Clerk session (getAuth) |

**Key invariants**:
- Each (channel, externalId) pair creates at most one ticket (enforced by IngestionEvent unique constraint).
- Each channel endpoint (email address or Telegram bot) maps to exactly one org (enforced by Channel unique constraint).
- A ticket is always created when a valid message is received (enforced by the triage pipeline's degradation contract).
- Channel secrets (bot token, SMTP credentials) are never stored in the database; they live in environment variables.
- Non-text Telegram messages create no ticket.
- Inbound email reads plain text only.

**Security model**:
- Email webhook: authenticated by a shared secret header (the SMTP server and the app share a secret).
- Telegram webhook: authenticated by the Telegram secret token (verified via `X-Telegram-Bot-Api-Secret-Token` header).
- Channel CRUD: org admin only (reuse the existing admin role check from `clerkService.js`).
- Reply dispatch: happens in the comment creation flow, which already requires a Clerk session.
- Rate limiting: reuse the existing `createLimiter` for webhook endpoints.
- PII (email addresses, Telegram user ids, names) is stored as plain text, consistent with existing Ticket fields. The database is internal.
- Webhook endpoints always return 200 OK on successful processing (even if the AI degraded), so providers do not retry. Malformed input returns 400.

**Configuration required**:
- `CHANNEL_SMTP_HOST`: SMTP server host (for the local smtp-server process)
- `CHANNEL_SMTP_PORT`: SMTP server port (default 2525 for dev, 25 for prod)
- `CHANNEL_SMTP_WEBHOOK_SECRET`: shared secret the SMTP server sends in the webhook header
- `CHANNEL_TELEGRAM_BOT_TOKEN`: Telegram bot token for sending replies
- `CHANNEL_TELEGRAM_WEBHOOK_SECRET`: Telegram secret token for webhook verification
- `CHANNEL_TELEGRAM_WEBHOOK_URL`: public HTTPS URL Telegram pushes updates to
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: nodemailer credentials for sending email replies

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: an inbound email creates a ticket with source "EMAIL", the sender is identified, and an agent reply is dispatched back via email, verifies **AC-1**, **AC-3**, **AC-4**, **AC-7**
- Happy path: an inbound Telegram text message creates a ticket with source "TELEGRAM", the sender is identified, and an agent reply is dispatched back via Telegram, verifies **AC-2**, **AC-3**, **AC-4**, **AC-7**
- Failure case: a duplicate webhook delivery (same messageId) is ignored and creates no second ticket, verifies **AC-5**
- Failure case: a non-text Telegram message (photo) creates no ticket, verifies **AC-9**
- Auth/permission: a non-admin user cannot create a channel (403), verifies **AC-8**
- Auth/permission: an invalid Telegram secret token is rejected (401), verifies **AC-2**

## Build plan

The build approach is Tracer Bullet: a thin end to end slice first (one channel, webhook to ticket to reply), then the second channel, then channel management.

**Slice 1: Email end to end**
1. Create the migration for the confirmed data model (Channel, IngestionEvent, Ticket.channelRecipient, ChannelType enum), satisfies **AC-5**, **AC-6**, **AC-8**
2. Build the Channel service (CRUD, lookup by identifier), satisfies **AC-6**, **AC-8**
3. Build the email webhook endpoint with shared secret auth and rate limiting, satisfies **AC-1**, **AC-6**, **AC-10**
4. Build the SMTP server integration (smtp-server receives email, calls the webhook), satisfies **AC-1**
5. Build the email reply dispatch in the comment flow (nodemailer), satisfies **AC-4**, **AC-7**

**Slice 2: Telegram end to end**
6. Build the Telegram webhook endpoint with secret token auth and rate limiting, satisfies **AC-2**, **AC-6**, **AC-9**
7. Build the Telegram reply dispatch in the comment flow (Bot API via fetch), satisfies **AC-4**, **AC-7**

**Slice 3: Channel management**
8. Build the channel CRUD endpoints with org admin auth, satisfies **AC-8**
9. Add the channel management UI to the dashboard (admin page), satisfies **AC-8**

## Consequences

**Positive**:
- Customers can submit tickets from email and Telegram, not just the web form.
- Channel tickets flow through the same triage pipeline, so they get the same AI triage and priority.
- Agent replies reach customers on their original channel.
- Admins can manage channels without a redeploy.

**Negative / tradeoffs**:
- The webhook blocks until the triage completes (including AI calls), so latency is higher than a fire and forget queue.
- A triage failure after the dedup record is created loses the message (accepted risk in v1).
- Running a local SMTP server adds an infrastructure component to operate (DNS, MX records, the SMTP process).
- The Telegram bot requires a public HTTPS URL for webhooks.

**Neutral**:
- Two new database tables (Channel, IngestionEvent) and one new enum (ChannelType).
- One new field on Ticket (channelRecipient).
- New env vars for SMTP and Telegram configuration.
- The feature reuses the existing triage pipeline, so no parallel code path to maintain.

## Follow-up

- [ ] Consider moving to the async PgBoss architecture (from AI_LAYER_PLAN.md) when message volume grows or when the webhook latency becomes a problem.
- [ ] Consider cross channel sender linking (the same person on email and Telegram) as a v2 feature.
- [ ] Consider attachment support (email attachments, Telegram documents) as a v2 feature.
- [ ] Consider a retry mechanism for failed IngestionEvents (events with no ticketId) as a v2 feature.
