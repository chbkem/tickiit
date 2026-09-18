<p align="center">
  <img src="./client/public/logo.svg" alt="tickiit" width="96" />
</p>

<h1 align="center">tickiit</h1>

<p align="center">Support tickets, sorted.</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933.svg" alt="Node >= 18" />
  <img src="https://img.shields.io/badge/AI-triage-purple.svg" alt="AI triage" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ED.svg" alt="Docker" />
</p>

tickiit is an open-source support ticketing dashboard that helps your team capture, assign, and close every support request in one place. Feed it a raw, unstructured complaint and it turns it into a clean, classified, prioritized ticket automatically — then track it to done without the clutter.

## Features

- **Clerk authentication** — passwordless-first sign in/sign up with organizations and roles out of the box
- **Full ticket lifecycle** — create, assign, edit, and delete tickets with statuses (Open, In Progress, On Hold, Resolved, Closed), priorities (Low → Urgent), and types (Task, Bug, Incident, Request)
- **Comments** — per-ticket discussion thread
- **Lifecycle timestamps** — `resolvedAt` / `closedAt` are tracked and cleared automatically when status changes
- **AI triage ingestion** — `POST /api/ai/triage` turns messy inbound complaints into clean ticket drafts automatically (see [AI triage](#ai-triage))
- **Sequential ticket numbers** — `#0001`, `#0002`, … allocated safely with Postgres advisory locks
- **Security & ops** — route-level rate limiting, Helmet headers, zod validation, HTML sanitization, CORS allow-listing, structured winston logging
- **Docker** — single-image build and one-command compose startup

## Prerequisites

- Node.js 18+ (the Docker image uses Node 20)
- A PostgreSQL database (Supabase, Neon, or anything Postgres-compatible works)
- A [Clerk](https://clerk.com) application (publishable + secret keys)
- *(Optional)* A Google AI / Gemini API key to enable the AI triage pipeline — without it, triage still works using deterministic fallbacks

## Setup

### 1. Install dependencies

From the repo root:

```bash
npm install
npm install --prefix client
npm install --prefix server
```

### 2. Configure the server

Copy the template and fill in your values:

```bash
cp server/.env.example server/.env
```

Required minimums: `DATABASE_URL`, `CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY`. Full reference below.

### 3. Configure the client

Create `client/.env.local`:

```
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Use the **publishable** key from the same Clerk application as the server.

### 4. Generate the Prisma client and sync the schema

```bash
npm run prisma:generate --prefix server
npm run prisma:push --prefix server
```

### 5. Run it

```bash
npm run dev
```

This starts the client on http://localhost:3000 and the server on http://localhost:5000 (CORS is pre-configured for localhost in development). Sign in, then open the dashboard at `/dashboard`.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection string (transaction pooler recommended) |
| `CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key (server) |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key (server) |
| `REACT_APP_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key (client) |
| `PORT` | | API port, defaults to `5000` |
| `NODE_ENV` | | `development` or `production` |
| `CORS_ORIGINS` | | Comma-separated frontend origins; defaults to `http://localhost:3000,http://127.0.0.1:3000` |
| `AI_INGEST_TOKEN` | | Shared secret gating `POST /api/ai/triage`. Unset ⇒ the ingest endpoint is disabled (503) |
| `AI_PROVIDER` | | Triage provider; `gemini` only for now. Defaults to `gemini` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | | Google AI API key for triage (`GEMINI_API_KEY` also accepted) |
| `AI_MODEL` | | Gemini model id, defaults to `gemini-3.8-flash` |
| `AI_AUTO_REPLY` | | `true` to enable customer draft replies by default; `false`/unset off unless a request passes `autoReply: true` |

Generate a random `AI_INGEST_TOKEN` with the built-in helper:

```bash
npm run token:generate --prefix server
```

## Docker

```bash
docker compose up -d
```

The compose file mounts `server/.env` and `client/.env.local`, forwards ports `3000` and `5000`, and binds to `0.0.0.0`. Build the image manually with:

```bash
docker build -t tickiit .
```

## AI triage

`POST /api/ai/triage` accepts a raw, unstructured complaint and returns a fully created ticket. It is the integration surface for channel adapters and webhooks (email, chat, forms), and is protected by `Authorization: Bearer <AI_INGEST_TOKEN>` or the `x-ingest-token` header.

```bash
curl -X POST http://localhost:5000/api/ai/triage \
  -H "Authorization: Bearer <AI_INGEST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "raw": {
      "subject": "Login fails after last night",
      "body": "Two people in finance cannot sign in since the deploy around 11pm. Getting a 500 from the auth API."
    },
    "channel": "email",
    "requesterRef": "user_2abc123",
    "orgId": "org_2def456",
    "autoReply": true
  }'
```

The pipeline runs in stages:

- **normalize** — sanitizes and caps the untrusted payload
- **identity** — maps the requester to a Clerk user, or derives a deterministic customer key (email → ref → name)
- **classify** — model writes a clean subject, description, and type
- **prioritize** — model chooses Low / Medium / High / Urgent
- **create** — agent loop that may inspect tickets/agents before persisting via the `create_ticket` tool
- **reply** *(optional)* — drafts a short confirmation reply (returned, never persisted)

A ticket is **always** created: if the AI provider is unavailable or a stage fails, the pipeline degrades to deterministic fallbacks (type `TASK`, priority `MEDIUM`) without erroring. The response includes the created ticket, requester info, an optional `draftReply`, per-stage results, and token usage.

## API reference

All endpoints are served under the API root and JSON only.

- `GET /api/tickets` — list visible tickets (all org-wide tickets when an org is active, else personal), grouped by priority *(Clerk session required)*
- `GET /api/tickets/:id` — single ticket with comments *(Clerk session required)*
- `POST /api/tickets` — create a ticket *(Clerk session required; admins may set requester/assignee in an org)*
- `PATCH /api/tickets/:id` — update fields; manages resolver/closer timestamps *(Clerk session required)*
- `DELETE /api/tickets/:id` — delete a ticket *(Clerk session required; org tickets require admin)*
- `GET/POST /api/tickets/:ticketId/comments` — list or add comments *(Clerk session required)*
- `POST /api/ai/triage` — AI triage ingest *(ingest token required)*

## Scripts

| Directory | Script | Description |
| --- | --- | --- |
| root | `npm run dev` | Run client and server concurrently |
| root | `npm run client` / `npm run server` | Run either side alone |
| server | `npm start` | Start the API |
| server | `npm run dev` | Start with file watching |
| server | `npm test` | Run server unit tests (Node's built-in runner) |
| server | `npm run token:generate` | Generate a random `AI_INGEST_TOKEN` |
| server | `npm run prisma:generate` / `prisma:push` / `prisma:validate` / `prisma:format` / `prisma:studio` | Prisma CLI helpers |
| client | `npm start` / `npm run build` / `npm test` | Standard Create React App scripts |

## Testing

- **Server** — Node's built-in test runner: `npm test --prefix server`
- **Client** — Jest (Create React App): `npm test --prefix client`

## Roadmap

- Pluggable AI providers — new providers plug into `server/src/ai/model.js` behind the existing return shape
- Channel adapters (email, Slack, web forms) that hand off to `POST /api/ai/triage`
- More triage tools (escalation, assignment suggestions) behind the same agent loop

## License

[MIT](LICENSE)