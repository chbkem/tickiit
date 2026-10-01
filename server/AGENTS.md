# server

## Overview

The Express 5 API. It owns all authentication, the ticket lifecycle, comments, the AI triage pipeline, and the knowledge base. Everything that touches PostgreSQL or Clerk happens here, inside `services/` or the AI module. The client never talks to the database or to Clerk directly.

## Key files

| File | Owns |
|---|---|
| `src/index.js` | App wiring in order: helmet, CORS, `json({ limit: "16kb" })`, the global `/api` limiter, `clerkMiddleware`, request logger, routers, not found, error handler |
| `src/lib/prisma.js` | The only place a `PrismaClient` is built, via the `PrismaPg` driver adapter |
| `src/lib/clerk.js` | The `clerkClient` singleton, built from `CLERK_SECRET_KEY`. `getAuth` is imported straight from `@clerk/express`, not from here |
| `src/lib/logger.js` | Winston. Colorized text in dev, JSON to `logs/app.log` in production, with sensitive keys redacted |
| `src/middleware/validate.js` | The zod seam. Parses `{ body, query, params }` and writes the result back onto `req` |
| `src/middleware/errorHandler.js` | The single place a status code is chosen for a failure |
| `src/utils/ApiError.js` | `new ApiError(statusCode, message, details)`, the only error class callers throw |
| `src/utils/sanitize.js` | `sanitizeText`, which strips every HTML tag. The gate for anything user authored |
| `src/utils/access.js` | `assertCanAccessTicket`, the personal ticket visibility rule |
| `src/utils/ticketNumber.js` | `#0001` style numbers, allocated under a Postgres advisory lock |
| `src/services/clerkService.js` | Every Clerk call and the only place role checks live (`ADMIN_ROLES = admin, org:admin`) |
| `src/routes/*.js` | Wiring only. No logic, no `prisma` |
| `prisma/schema.prisma` | `Ticket`, `Comment`, `KnowledgeArticle`, `KnowledgeChunk` plus four enums. No `url` in the datasource |
| `prisma/sql/*.sql` | Hand run SQL: enable the pgvector extension, then build the HNSW index |
| `.env.example` | The most accurate env reference in the repo. More current than the root README |
| `docs/scope/scope.md` | The feature status board. Read it first to learn what is done |

## Commands

```bash
npm run dev                 # node --watch src/index.js
npm start                   # node src/index.js
npm test                    # node --test "src/**/*.test.js"
node --test src/ai/knowledge/chunker.test.js   # one file
npm run token:generate      # print a random AI_INGEST_TOKEN
npm run test:api            # manual triage smoke test, add --send to really POST
npm run prisma:generate     # also runs automatically on postinstall
npm run prisma:push
npm run prisma:studio
```

Database setup, and the order matters:

```bash
npx prisma db execute --file prisma/sql/enable-pgvector.sql   # before the push
npm run prisma:push
npx prisma db execute --file prisma/sql/knowledge-hnsw-index.sql  # after the push
```

## Conventions

- Four layers, always: `routes/` wires, `middleware/validate.js` validates, `controllers/` authorize and orchestrate, `services/` hold every Prisma and Clerk call. `controllers/kb.js` is the one controller that skips `services/`, because `ai/knowledge/knowledgeService.js` fills that role.
- Zod schemas are shaped `{ body, query, params }` and live in `src/validators/`, one file per domain. Bodies are `.strict()`. Update schemas add a `.refine` that rejects an empty update.
- Every string that reaches the database or a prompt is `sanitizeText`ed inside a `z.preprocess`. Helper functions for this are local to each schema file, not shared.
- Controllers never call `res.status()` for a failure. They throw `ApiError` and let `errorHandler` map it: `P2002` to 409, `P2025` to 404, `P2023` to 400, anything with a numeric `.status` (Clerk) to 502, everything else to 500.
- Org identity comes from the Clerk session only. `getAuth(req)` gives `userId`, `orgId`, `orgRole`. If an org is active, all org tickets are visible and admins may set requester and assignee; without an org, a ticket is visible only when the caller is requester or assignee.
- Machine auth is separate: `requireIngestToken` guards `POST /api/ai/triage` with a constant time compare of a shared secret.
- The rate limiter factory in `src/middleware/rateLimit.js` is the only place limits are defined, and every caller goes through it (100 per 15 minutes global in `src/index.js`, 30 for writes, 60 for triage).
- Tests are `node:test` plus `node:assert/strict`, colocated as `<sibling>.test.js`, no mocking library. Dependencies are injected as optional parameters (`db`, `embedder`, `env`, `clerkClient`, `ticketService`) defaulting to the real module.

## Gotchas

- **`AI_INGEST_TOKEN` unset does not mean unauthorized, it means 503.** The triage endpoint is disabled entirely and says "Ingestion is not configured on this instance." This is the most common reason triage looks broken.
- **Prisma 7 with a driver adapter.** `schema.prisma` has no `url`, so the CLI reads `DIRECT_URL` from `prisma7.config.ts` while the runtime client reads `DATABASE_URL`. They are different connections: the CLI wants a direct one, the runtime is happy on the pooler. Importing `PrismaClient` anywhere other than `src/lib/prisma.js`, or adding a `url` to the datasource, breaks it.
- **pgvector must be enabled by hand.** `prisma db push` cannot create the `vector` type. Run `prisma/sql/enable-pgvector.sql` first, and the HNSW index file after the push, because the table has to exist first. Neither step is wired into an npm script.
- **`postinstall` runs `prisma generate`,** so a broken schema fails `npm install` itself.
- **Rate limits live in process memory.** Each replica counts on its own, and the factory warns once in production.
- **CORS defaults to localhost only and the failure is quiet.** `configureCors()` falls back to the two localhost origins and only warns when `NODE_ENV` is exactly `production`.
- **`GET /api/tickets` returns an object grouped by priority,** not an array: `{ urgent: [...], high: [...] }`.
- **Ticket numbers are safe only inside the transaction.** `pg_advisory_xact_lock` plus a `MAX` scan must run in the same `$transaction` as the insert in `ticketService.createTicket`.
- **`sanitizeText` strips all HTML,** so authored markup and any markup a model emits is silently dropped.
- **`AI_LAYER_PLAN.md` describes a much larger AI layer that is almost entirely unbuilt** (a PgBoss queue, an `AgentRuntime`, provider abstraction, new models). Treat it as intent. Only `src/ai/knowledge/` and the `create_ticket` tool overlap with reality.
- The knowledge base is the newest feature and is part built, part wired. See `src/ai/AGENTS.md` and `src/ai/knowledge/AGENTS.md` for what is done and what is not.

## Agent skills

- [prisma-upgrade-v7](.agents/skills/prisma-upgrade-v7/): `prisma/skills`, what changed in Prisma 7, including the driver adapter requirement
- [prisma-driver-adapter-implementation](.agents/skills/prisma-driver-adapter-implementation/): `prisma/skills`, transaction lifecycle and error mapping for the pg adapter
- [prisma-client-api](.agents/skills/prisma-client-api/): `prisma/skills`, query and filter syntax for every `prisma.*` call here
- [prisma-cli](.agents/skills/prisma-cli/): `prisma/skills`, the CLI behind the `prisma:*` scripts, `db execute`, and `studio`
- [prisma-database-setup](.agents/skills/prisma-database-setup/): `prisma/skills`, connecting a new PostgreSQL database
- [prisma-postgres](.agents/skills/prisma-postgres/): `prisma/skills`, provisioning and managing a managed PostgreSQL database

## Related specs

- [AI knowledge base](docs/specs/0001-ai-knowledge-base/index.md), status in progress
- [Its rationale](docs/specs/0001-ai-knowledge-base/rationale.md), why local embeddings and pgvector won
- [The verify checklist](docs/specs/0001-ai-knowledge-base/verify.md), still fully unticked

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
