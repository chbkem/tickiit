# 0001. Knowledge base for the AI triage pipeline, rationale

## Context

> Premise note: automatic ticket assignment is a separate feature that this spec does not cover. The knowledge base feeds the reply draft endpoint and the triage `search_knowledge` tool, but the create agent still must not assign anyone. Routing rules belong in a playbook article and in an agent skills map later, not in a hidden side effect of this spec.

The support flow already creates tickets through an AI pipeline (normalize, classify, prioritize, create, optional draft reply) that runs on the Vercel AI SDK with Gemini. Two gaps sent the team here. First, the AI has no source of truth, so a draft reply that tries to answer a customer question could invent an answer. Second, the orgs customers are support teams who keep their answers in SOPs, FAQs, and Word or PDF documents, not in markdown the pipeline can read.

The forces that shaped this decision:

- The team is small and the server is one Express app on Prisma 7 with Postgres on Supabase, Clerk for auth, and the AI SDK for model calls. There is no worker, no queue, and no object storage.
- Embedding cost and data egress matter. A per token embedding API adds recurring cost and sends document text to a third party.
- Multi tenancy is real. Every org of the product is a separate Clerk organization, and cross tenant leakage is the worst outcome for a knowledge store.
- Replies to customers are treated as human owned today. The existing reply agent already returns a draft and never persists it. The KB reply feature should keep that discipline.
- No `AGENTS.md` exists anywhere in the repo, and there is no scope file yet. Build approach is not recorded, so thin end to end slices are the assumed default.

## Options considered

### Option 1: Local open source embeddings with pgvector

A small Transformer.js model (a library that runs ONNX models in Node) embeds chunks on the server, and Postgres stores 384 dimension vectors with the pgvector extension. Similarity search runs in the database with the near operator.

**Pros**:
- Free at runtime, no API key, no data egress for document text.
- Reuses the existing Postgres instance; no new service.
- Fits the org's stated desire for a small open source model in JavaScript.

**Cons**:
- One raw SQL detour for the vector column, outside the typed Prisma client.
- Model weights download on first use and add memory to the server process.
- The pgvector extension must exist on the hosted database.

### Option 2: Hosted embedding API on the existing Gemini key

Call a hosted embedding model using the Google key the project already carries.

**Pros**:
- No local model to warm up or cache, strong multilingual support.
- Small code footprint next to the existing AI SDK.

**Cons**:
- Recurring per token cost for every upload and every query.
- Document text leaves the server and goes to the provider.
- Adds a network call on the synchronous ingestion path.

### Option 3: Keyword and tag search only, no embeddings

Match on article tags, title, and body text with the SQL text search or an application scan.

**Pros**:
- Simplest possible build, no model, no vector column.

**Cons**:
- Weak for natural language questions that paraphrase the stored text.
- Does not grow with the knowledge base, which is the point of the feature.

### Option 4: A hosted RAG or vector vendor

Stand up a managed knowledge or vector store service and call it from the pipeline.

**Pros**:
- Managed search quality, no self hosted vector operations.

**Cons**:
- New vendor, new credentials, and document egress for a small self hosted repo.
- Adds operational surface the team would rather not run on day 180.

### Storage and flow options

Markdown only versus keeping original files: markdown only was chosen because `article.body` becomes the single source for re chunking and keeps the database lean. Keeping originals helps re extraction later but adds blob handling with no queue or object storage in place yet.

Synchronous ingestion versus a background queue: synchronous was chosen because no worker exists and files are capped at 10 MB, so chunk and embed work fits in the request. A queue is a later upgrade, not a v1 requirement.

Reply endpoint auth: signed in org member was chosen over a machine token because the primary user is a human agent pressing a button in the dashboard, and the endpoint must honor ticket access. A machine token path can come later with the channel adapters.

Reply surface: draft only was chosen to extend the existing principle (the current reply agent already returns a draft and never persists it) to comment replies.

## Rationale

The local model and pgvector win because they match the forces: the org wants a small free model in JavaScript, the team already runs Postgres, and no document text should leave the server for a feature whose whole value is answering from what the org uploads. The hosted API option is the runner up and is worth revisiting if multilingual quality becomes the deciding factor, at the cost of money and egress.

Raw SQL for the vector column is the price of using Prisma 7 with pgvector, and it is contained to the chunk insert and the similarity query. Everything else stays in the typed client. Chunking and embedding synchronously keeps the search immediately useful with no queue infrastructure, which is the right trade at this scale. Draft only replies carry forward the project's clear stance that a human owns customer communication. Org scoping is the enforcement the multi tenant requirement needs, and upload validation exists precisely because a confident answer built from garbage extraction is worse than a clear failure message.

## Evidence

None collected. No existing code, spec, or `AGENTS.md` was referenced in the making of this decision beyond the repo layout and the AI pipeline summarized above.