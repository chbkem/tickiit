# tickiit

Two npm packages in one repo, wired by a root script. Not npm workspaces: each side is installed and run on its own with the `--prefix` flag. Read the linked `AGENTS.md` for the side you are working in.

## Stack

- **Language / Runtime**: JavaScript only (no TypeScript), Node 18 or newer, Docker uses Node 20
- **Framework**: Express 5 API in `server/`, Create React App 5 client in `client/`
- **Key dependencies**: Prisma 7 with the pg driver adapter and PostgreSQL, Clerk for auth, Vercel AI SDK 7 with Google Gemini, pgvector plus local embeddings from `@huggingface/transformers`, Tailwind 3 with a shadcn style token set
- **Package manager**: npm

## Build approach

<TBD, set by /scope>

## Commands

```bash
# Install (all three, in this order)
npm install
npm install --prefix client
npm install --prefix server

# Dev servers (client on 3000, server on 5000)
npm run dev
npm run client          # one side only
npm run server

# Test
npm test --prefix server   # Node built in runner, server only
npm test --prefix client   # Jest, but there are no client tests yet

# Database
npm run prisma:generate --prefix server
npm run prisma:push --prefix server
npm run prisma:studio --prefix server
```

There is no lint command, no formatter, and no CI anywhere in the repo. Do not offer to add them as if they existed.

## Specs

Specs are a folder per feature under `server/docs/specs/NNNN-title/`. The scope board is `server/docs/scope/scope.md`, and it is the best single answer to what is built and what is next. `server/AI_LAYER_PLAN.md` is future intent; almost none of it exists yet.

## Rules

- The server is CommonJS throughout (`require`, `module.exports`). The client is ESM `import`. Do not mix them.
- Every server route follows the same four layers: `routes/` wires only, `middleware/validate.js` runs zod, `controllers/` check auth and orchestrate, `services/` hold every Prisma and Clerk call.
- Business errors are thrown as `new ApiError(statusCode, message, details)`. Never call `res.status()` for a failure, and never leak a raw error to the client.
- Any string that reaches the database or a prompt goes through `sanitizeText` first, usually inside a zod `preprocess`. Tenant and org identity always comes from the Clerk session (or from `ctx` in the AI path), never from a request body field.
- Test files sit next to the code they cover as `<sibling>.test.js`, use `node:test` with `node:assert/strict`, and inject dependencies as optional parameters instead of mocking modules.
- On the client, pages call `hooks/`, hooks call `actions/`, actions call `fetch` with a Clerk token. There is no axios wrapper even though axios is installed.
- Client files are `kebab-case`, components are `.jsx`, plain modules are `.js`. A few hook files use `.jsx` without holding any JSX; match the file you are editing rather than tidying it.

## Agent skills

Declined: registry search for more Agent Skills and MCP servers (the packs this repo needs are already installed under `server/.agents/skills/` and `client/.agents/skills/`).

## Context files

- [server/AGENTS.md](server/AGENTS.md): the Express API, its four layers, error mapping, org rules, and Prisma 7 with pgvector
- [client/AGENTS.md](client/AGENTS.md): the React app, the page to hook to action flow, the hand rolled component kit, and the Tailwind token set
- [server/src/ai/AGENTS.md](server/src/ai/AGENTS.md): the triage pipeline, the always create contract, the two fences, and the four tools
- [server/src/ai/knowledge/AGENTS.md](server/src/ai/knowledge/AGENTS.md): chunking, local embeddings, the raw SQL the vector column forces, and what is still unbuilt

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
