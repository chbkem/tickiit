# server/src/ai

## Overview

The AI layer: a triage pipeline that turns a raw, unstructured complaint into a created ticket, and a knowledge base that can answer questions about an org's documents. Everything that touches a model goes through here. The pipeline always creates a ticket, degrading to deterministic defaults when the model is unavailable, so an outage never loses an inbound request.

## Key files

| File | Owns |
|---|---|
| `model.js` | `createModel({ env })`, Gemini only, throws on an unknown `AI_PROVIDER` |
| `pipeline/runTriage.js` | The orchestrator. Every stage, every fallback, the token budget, and the exactly once create guard |
| `pipeline/normalize.js` | The untrusted input gate. Maps loose keys to `subject` and `body`, caps lengths, sanitizes, raises `NormalizeError` |
| `identity.js` | Resolves a requester ref to a Clerk user, or derives a stable sha256 customer key when there is no match |
| `agent/runAgent.js` | `runStructured` and `runToolLoop`, the only two calls into the AI SDK, plus the abort timeout |
| `agents/classify.js` | Writes a clean subject, description, and type |
| `agents/prioritize.js` | Chooses Low, Medium, High, or Urgent |
| `agents/create.js` | The only agent with tools. Stops on `hasToolCall("create_ticket")` or the step cap |
| `agents/reply.js` | Drafts a short confirmation. Returned to the caller, never persisted |
| `contracts/triageOutput.js` | The four zod schemas every model output is parsed into |
| `tools/index.js` | `createTools({ ctx })`, the four tools, all scoped by `ctx` |
| `tools/dataFence.js` | Wraps user authored free text in `<untrusted_data>` and strips embedded fence tokens |

## Conventions

- Layering is strict and by folder: `pipeline/` orchestrates, `agents/` are one file per stage, `agent/runAgent.js` is the shared runner, `tools/` are the model's capabilities, `contracts/` are the zod output shapes. `knowledge/` sits alongside as its own subsystem.
- Every stage returns `{ kind: "model" | "fallback", ... }` and catches its own failure, so one bad stage never takes down the request. The response `stages` array carries `kind`, `usage`, and `error` per stage.
- `ctx` in `runTriage` carries `env`, `identity`, `orgId`, `channel`, `prisma`, `clerkClient`, `ticketService`, and `createTicket`. Tools read tenant scope from `ctx` and never from model supplied arguments. That is the isolation boundary for the whole AI path.
- `runTriage({ input, deps })` takes everything through `deps`, so tests inject a fake model, a fake `prisma`, and fake stage runners without touching a module level singleton.
- Output schemas are written to be usable as both a tool `inputSchema` and an `Output.object` schema: `uppercaseEnum` uses trim, uppercase, and a refine rather than `z.enum`, because the same object has to survive JSON schema conversion.
- `TicketDraft` is a closed world. No status, no assignee, no id, no delete. The create tool can only create.
- The pipeline never assigns. `list_agents` ranks the least loaded agents for the model's information, and that is all it does.

## Gotchas

- **A ticket is always created.** If the provider is missing, the key is wrong, or a stage throws, the answer is the deterministic fallback (type `TASK`, priority `MEDIUM`), never an error. The one thing that does fail the request is input that `normalize` cannot read.
- **`AI_INGEST_TOKEN` unset turns the endpoint off with a 503,** not a 401. See `middleware/requireIngestToken.js`.
- **`AI_ENABLED=false` is the kill switch.** It is checked before `createModel` is even built, and the response records `modelError` rather than failing.
- **The token budget is checked before each stage,** using `usage.totalTokens <= budget`. A stage that is over budget is skipped and the fallback is used, and it records a `budgetError`.
- **The abort timeout uses `setTimeout(...).unref()`** so a pending model call never holds the process open. Do not drop the `unref`.
- **Two fences, not one.** The prompt side tells the model that content inside a tag is data, and `dataFence.js` strips `</untrusted_data` from stored text so an article cannot close the fence around itself. Both must be kept.
- **`list_agents` returns an empty array with no org,** and `get_ticket` returns the same not found message for a missing ticket and one from another tenant, so no existence leaks.
- **`POST /api/ai/triage` trusts the `orgId` in its own body.** An ingest token, not a Clerk session, authenticates this call, and nothing verifies the caller may write to that org. The knowledge retriever inherits the same assumption.
- `scripts/test-ai-triage.js` prints a dry run by default. `npm run test:api -- --send` is what actually POSTs.

## Related specs

- [AI knowledge base](../../docs/specs/0001-ai-knowledge-base/index.md), the `search_knowledge` tool and the comment reply endpoint are still unbuilt
- [AI layer plan](../../AI_LAYER_PLAN.md), a much larger design that is almost entirely unbuilt

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
