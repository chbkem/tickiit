# 0001. Harden public form submissions against spam and abuse

**Date**: 2026-11-14
**Status**: Proposed

## Summary

This adds layered protection to the public ticket form: a signed timing token, a self hosted proof of work challenge, content screening, per email limits, a blocklist, and a quarantine state for tickets that look like spam. Every attempt is recorded so limits work across restarts and instances, and so you can see why something was held. Real customers keep a simple form and a clear error when they made a mistake; bots get a normal success response and a ticket that is hidden from the inbox.

## Context

The public form is the only unauthenticated write path in the product. Anyone with the link can create a ticket, which consumes a ticket number, a database row, an agent's attention, and potentially a confirmation email. Today the defenses are schema validation, HTML stripping, one hidden field, a client reported fill time, and an in memory IP rate limit. Public links get scraped, so a single layer always leaks: reading the page source is enough to pass the hidden field and the timing value.

> ⚠️ Premise note: quarantining by creating a real ticket means a bot flood still consumes ticket numbers and database rows in the same table as real work. This spec caps quarantined tickets per IP per hour and rejects beyond that cap, and it keeps quarantined tickets out of the default list. Without that cap, a determined sender can still grow the table and exhaust ticket numbers even though agents never see the spam.

The form is uncommitted work in progress, so the client and server shape can change together. There is no live customer traffic to migrate, and no compliance standard is on record for this project. The database is Postgres through Prisma, the server is Express 5, and the client is React.

## Requirements

**User stories**:
- As a customer, I want to submit a support request without solving a puzzle more than once, so that I get help quickly.
- As an agent, I want spam held out of my inbox, so that I only see work that matters.
- As the operator, I want to see why a submission was held or rejected, so that I can tune the rules and recover a false positive.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: A submission that fails schema validation returns 400 with field level messages, creates no ticket, and writes no attempt row.
- **AC-2**: A valid submission returns 201 with `ticketNumber`, `subject`, and `confirmationSent`, creates a ticket with `isSpam` false, and records an attempt with verdict `ACCEPTED`.
- **AC-3**: A submission with the honey pot field filled returns 201 with a real ticket number, creates a ticket with `isSpam` true, sends no confirmation email, and records an attempt with verdict `QUARANTINED` and reason `honeypot`.
- **AC-4**: A submission whose server measured fill time is under 1500 ms is quarantined with reason `min_fill_time` and the same response shape as AC-3.
- **AC-5**: A submission with a missing, malformed, or tampered form token returns 400 with a reload message, creates no ticket, and records a `REJECTED` attempt with reason `bad_form_token`.
- **AC-6**: A submission with a missing, expired, or invalid proof of work payload returns 400 asking the user to complete the verification step, creates no ticket, and records a `REJECTED` attempt with reason `pow_invalid`.
- **AC-7**: A second submission from the same email inside 5 minutes returns 429 with a friendly message that names the earlier ticket number, creates no new ticket, and records a `REJECTED` attempt with reason `duplicate_window`.
- **AC-8**: A sixth accepted or quarantined submission from the same email inside 24 hours returns 429 with a rate limit message, creates no ticket, and records a `REJECTED` attempt with reason `email_daily_limit`.
- **AC-9**: More than 20 submissions from one IP inside 15 minutes returns 429 from the rate limiter.
- **AC-10**: A subject and message containing more than 2 URLs is quarantined with reason `link_cap`.
- **AC-11**: A subject or message matching a banned term (case insensitive) is quarantined with reason `banned_term`.
- **AC-12**: A message whose normalized body matches an accepted or quarantined submission from a different email inside 24 hours, or that repeats the same phrase 5 or more times, is quarantined with reason `repeated_text`.
- **AC-13**: A submission from a blocklisted email, a blocklisted email domain (including its subdomains), or a blocklisted IP hash returns 400 with a generic rejection message, creates no ticket, and records a `REJECTED` attempt with reason `blocklisted`.
- **AC-14**: Every quarantined ticket has `isSpam` true, a positive `spamScore`, a non empty `spamReasons` list, and a `quarantinedAt` timestamp.
- **AC-15**: The ticket list excludes spam by default, accepts `isSpam=true` to return only spam, and keeps the existing org or ownership scoping either way.
- **AC-16**: The attempt log stores only salted hashes of the IP and email, plus the email domain, and never the raw IP or raw email.
- **AC-17**: A daily cleanup deletes attempts older than 90 days and quarantined tickets older than 30 days, and leaves accepted tickets alone.
- **AC-18**: A normal message with no links, ordinary text, a valid token, a valid proof of work, and more than 1500 ms of fill time is accepted and never quarantined.
- **AC-19**: More than 25 quarantined tickets from one IP inside one hour returns 429 instead of creating a ticket.
- **AC-20**: If the attempt log write or the counter query fails, the error is logged and the request continues so a legitimate submission is never blocked by a logging failure.

## Options considered

### Option 1: Fix in place with stronger rules and a database backed attempt log

Keep the current endpoint and add a guard service: signed form token, proof of work, content rules, per email limits, blocklist, attempt log, and a quarantine flag on the ticket.

**Pros**:
- Reuses the existing stack and endpoint shape; no new infrastructure to operate.
- Counters survive restarts and work across instances because they live in Postgres.
- Keeps one place to tune rules and one audit trail to explain decisions.

**Cons**:
- Adds two tables and a scheduled cleanup that someone must own.
- Every attempt is a write, so a flood still costs database work.

### Option 2: Add a hosted challenge only (Cloudflare Turnstile)

Delegate bot detection to a third party widget and keep the other rules light.

**Pros**:
- Strongest bot signal per line of code, usually invisible to users.
- The provider maintains detection as bots change.

**Cons**:
- Requires a Cloudflare account, site keys, and a client script from their CDN.
- Shares visitor data with a third party, which sits badly with a self hostable product.
- Does nothing about content spam from a human or a paid solver.

### Option 3: Self hosted proof of work plus an attempt log, no content rules

Add the signed token, the proof of work, and the attempt log, but leave text screening out.

**Pros**:
- Smallest change that closes the forged timing hole.
- Very low false positive risk.

**Cons**:
- Human spam and paid solving still get through.
- No record of why anything was rejected, so tuning is guesswork.

### Option 4: Keep the current checks and lower the limits

Tighten the existing IP limit and the minimum fill time, and leave the rest as is.

**Pros**:
- Almost no work.

**Cons**:
- The measured value is client controlled, so the timing check stays decorative.
- Tight IP limits punish shared office and school networks first.
- No audit trail and no recovery path for a refused customer.

## Decision

**Chosen option**: Option 1: Fix in place with stronger rules and a database backed attempt log, with the proof of work from Option 3.

A single guard service decides one of three verdicts for each submission: accepted, quarantined, or rejected. Verdicts drive the response, the ticket state, and the attempt record. The proof of work uses the official Altcha client widget and server library, and the timing value is a server signed token instead of a client number.

**Implementation skills**: none installed for this stack.

## Rationale

The product is a public support form that must stay usable by a real person on a bad connection, so the strongest single control cannot be an aggressive puzzle. Layering cheap independent signals (honey pot, server measured fill time, proof of work, content shape, sender history, blocklist) gets strong protection while each rule stays forgiving on its own. The engineer chose silent success for high confidence spam because telling a bot which check failed teaches it exactly what to change, and chose a real ticket number so a false positive can still be found and released.

Counters live in Postgres because the current in memory limiter resets per instance and on restart, which is precisely the weakness a determined sender exploits. Postgres is already running, so this adds no infrastructure, and the attempt log doubles as the audit trail the current design lacks.

A third party challenge was the runner up. It detects bots better per line of code, but it adds an external account, a CDN script, and visitor data sharing to a product that ships as something you can host yourself. Self hosted proof of work keeps the same property with no external dependency.

## Feature design

**Data model sketch**:

`FormSubmissionAttempt` (new)

| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| formId | uuid, nullable | plain column, not a foreign key, so it survives form deletion |
| publicId | string | survives form deletion |
| ipHash | string | salted SHA-256 of the client IP |
| emailHash | string, nullable | lowercased trimmed email, then salted SHA-256 |
| emailDomain | string, nullable | parsed from the validated email |
| verdict | enum `AttemptVerdict` | `ACCEPTED`, `QUARANTINED`, `REJECTED` |
| score | int, default 0 | sum of triggered rule weights |
| reasons | string[] | rule ids such as `honeypot`, `link_cap` |
| ticketId | string, nullable | set only when a ticket row was created |
| createdAt | datetime, default now | |

Indexes: `(ipHash, createdAt)`, `(emailHash, createdAt)`, `(formId, createdAt)`, `(verdict, createdAt)`, `(createdAt)` for retention.

`BlocklistEntry` (new)

| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| kind | enum `BlocklistKind` | `EMAIL`, `DOMAIN`, `IP` |
| value | string | normalized match key; for `IP` it holds the salted hash, never the raw address |
| reason | string, nullable | |
| createdBy | string, nullable | Clerk user id, null for system entries |
| expiresAt | datetime, nullable | null means permanent |
| createdAt | datetime, default now | |

Unique on `(kind, value)`. The bundled disposable domain list stays in code; this table is for manual entries.

`Ticket` additions: `isSpam` boolean default false, `spamScore` int default 0, `spamReasons` string[] default empty, `quarantinedAt` datetime nullable. Index `(orgId, isSpam, createdAt)`. The `Status` enum is untouched.

**State transitions**:

Submission verdict flow:
1. Rate limiter (20 per IP per 15 minutes) rejects with 429.
2. Schema validation rejects with 400 (AC-1).
3. Guard, in order: form lookup, blocklist, form token, proof of work, honey pot, fill time, per email duplicate and daily limits, quarantine flood cap, content score.
4. Verdict `REJECTED` returns 400 or 429 and writes an attempt row.
5. Verdict `QUARANTINED` creates a ticket with `isSpam` true, writes the attempt row, sends no email, returns 201.
6. Verdict `ACCEPTED` creates a normal ticket, writes the attempt row, sends the confirmation email, returns 201.

Quarantined ticket: created hidden, stays out of the default list, and is deleted by retention after 30 days. Releasing a ticket means an agent unsets `isSpam` and clears `quarantinedAt`; that is a manual database action for now, because this spec ships no admin UI.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/public/forms/:publicId` | GET | `publicId` | `publicId`, `name`, `description`, `orgName`, `formToken` | none | 404 form inactive or missing |
| `/api/public/forms/:publicId/challenge` | GET | `publicId` | Altcha challenge object (`algorithm`, `challenge`, `maxnumber`, `salt`, `signature`) | none | 404 form inactive or missing |
| `/api/public/forms/:publicId/submit` | POST | `name`, `email`, `subject`, `message`, `website` (honey pot), `formToken`, `altcha` | `ticketNumber`, `subject`, `confirmationSent` | none | 400 validation, 400 verification, 400 bad token, 400 blocklisted, 404 form, 429 duplicate window, 429 daily limit, 429 limiter |
| `/api/tickets` | GET | `isSpam` (optional boolean query) | tickets grouped by priority, spam excluded by default | Clerk bearer | 401 |

`elapsedMs` is removed from the request body. The schema is strict, so an old client sending it gets a 400 instead of a silently ignored field.

The 429 duplicate response includes the earlier `ticketNumber`. This reveals to a caller who already knows an email address that the address submitted a ticket in the last 5 minutes. That is an accepted tradeoff for a better customer experience, and it is recorded in Consequences.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| GET form | `formToken` | server signs `{ publicId, issuedAt }` with `FORM_TOKEN_SECRET` using HMAC-SHA256 |
| guard | `issuedAt` | verified payload from `formToken` |
| guard | fill time | `Date.now()` minus `issuedAt` from the verified token |
| guard | `ipHash` | `req.ip` plus `SPAM_IP_SALT`, hashed with SHA-256 |
| guard | `emailHash` | lowercased trimmed `email` from the validated body plus `SPAM_IP_SALT` |
| guard | `emailDomain` | part after `@` in the validated email |
| guard | link count | URL matches in `subject` plus `message`, from the validated body |
| guard | banned term match | `BANNED_TERMS` constant against the validated body |
| guard | repeated text match | normalized `message` compared with stored attempts and a phrase repetition count |
| guard | `score`, `reasons` | rule weights in `spamRules.js` |
| guard | per email counts | `FormSubmissionAttempt` rows with verdict `ACCEPTED` or `QUARANTINED` |
| guard | per IP quarantine count | `FormSubmissionAttempt` rows with verdict `QUARANTINED` |
| guard | blocklist match | `BlocklistEntry` by email, domain with subdomain match, and IP hash, ignoring expired entries |
| GET challenge | Altcha challenge fields | `createChallenge` from the Altcha server library with `ALTCHA_HMAC_KEY` |
| submit | proof of work result | `verifySolution` from the Altcha server library with `ALTCHA_HMAC_KEY` |
| submit | `ticketNumber` for the duplicate response | existing ticket row matched by `emailHash` window |
| GET tickets | spam exclusion or filter | `isSpam` query param, default false |

**Key invariants**:
- One verdict per submission. A guard that throws resolves to `REJECTED` with reason `guard_error` only for the bot checks; log and infra failures fail open (AC-20).
- A quarantined submission never sends a confirmation email.
- Quarantined tickets never appear in the default list and are never sent to AI triage.
- Links are counted across subject and message, and a submission is quarantined when the count is greater than 2.
- Quarantine weights: `honeypot` 100, `min_fill_time` 80, `banned_term` 100, `repeated_text` 70, `link_cap` 60. Any single rule reaches the quarantine threshold of 50.
- The form token is valid for 24 hours. An expired token returns 400 with a reload message, never a quarantine.
- The proof of work solution expires on the Altcha challenge window and is rejected after it expires, so a stale solved challenge cannot be reused indefinitely.
- Rate limit counts include accepted and quarantined attempts, not rejected ones, so a rejected spammer can retry without inflating their own limit.
- Blocklist lookups ignore entries whose `expiresAt` is in the past.
- Secrets are read from the environment and the server refuses to start in production if a secret is missing.

**Security model**:
- The submit endpoint stays public and unauthenticated, which is the point of the feature. All controls are server side.
- The attempt log holds salted hashes and the email domain only. Raw email stays on the ticket as today.
- Blocklist and attempt tables are never exposed through a public route. Listing spam tickets requires the existing Clerk auth and the existing org or ownership scoping.
- The blocklist is operator maintained through the database for now, so there is no new privileged surface.
- `app.set("trust proxy", ...)` must be configured behind a proxy, otherwise `req.ip` is the proxy address and both the IP limit and the IP blocklist silently stop working.
- The in process rate limiter remains per instance; the database limits are the real cross instance control.

**Configuration required**:
- `FORM_TOKEN_SECRET`: 32 or more random bytes as hex, signs the form token.
- `ALTCHA_HMAC_KEY`: 32 or more random bytes as hex, creates and verifies the proof of work.
- `SPAM_IP_SALT`: 32 or more random bytes as hex, salts the IP and email hashes.
- `TRUST_PROXY`: Express trust proxy setting, a hop count or `true`; required when deployed behind a proxy.
- `server/src/spam/spamRules.js` constants: `MIN_FILL_MS` 1500, `LINK_LIMIT` 2, `QUARANTINE_SCORE` 50, `EMAIL_WINDOW_MS` 5 minutes, `EMAIL_DAILY_LIMIT` 5, `EMAIL_DAILY_WINDOW_MS` 24 hours, `IP_LIMIT` 20, `IP_WINDOW_MS` 15 minutes, `QUARANTINE_IP_HOURLY` 25, `FORM_TOKEN_TTL_MS` 24 hours, `ATTEMPT_RETENTION_DAYS` 90, `QUARANTINE_RETENTION_DAYS` 30, `BANNED_TERMS`, `DISPOSABLE_DOMAINS`.

**Critical test scenarios** (each maps to an acceptance criterion in Requirements):
- Happy path: valid form values, valid token, valid proof of work, fill time above 1500 ms, verifies **AC-2** and **AC-18**.
- Failure case: honey pot filled with everything else valid and the response still looks like success, verifies **AC-3** and **AC-14**.
- Failure case: same email submits twice in 10 seconds and the second response names the first ticket, verifies **AC-7**.
- Failure case: three links in the message, verifies **AC-10**.
- Failure case: blocklisted domain with a subdomain sender, verifies **AC-13**.
- Failure case: attempt log write throws and the ticket is still created, verifies **AC-20**.
- Auth/permission: a caller outside the org asks for `isSpam=true` and sees nothing beyond their own scope, verifies **AC-15**.
- Retention: a seeded 91 day old attempt and a 31 day old quarantined ticket are removed, an accepted ticket is kept, verifies **AC-17**.

## Build plan

Approach: no build approach is recorded in the repository, so this plan uses thin end to end slices. Slice 1 puts a working guard in the request path with only the signals that already exist, so the response shapes and the ticket state are proven before more rules are added. Each later slice adds one group of rules to a path that already works.

1. Add the Prisma migration for `FormSubmissionAttempt`, `BlocklistEntry`, the new ticket fields, and the indexes, with nullable columns and defaults so nothing existing breaks. Satisfies AC-14, AC-16.
2. Build the attempt log service (write, per email and per IP counts, duplicate lookup, retention purge) with unit tests. Satisfies AC-7, AC-8, AC-16, AC-17, AC-19.
3. Issue the signed form token from the existing form load and verify it in a guard module, removing `elapsedMs` from the schema and the client. Satisfies AC-4, AC-5, AC-18.
4. Add a guard service with the three verdicts and wire it into the controller: quarantine path, 201, 429, 400 shapes, no email for quarantine. Only honey pot and fill time rules in this slice. Satisfies AC-2, AC-3, AC-14, AC-20.
5. Add content screening as pure functions (link count, banned terms, phrase repetition, body normalization) and fold them into the guard. Satisfies AC-10, AC-11, AC-12, AC-18.
6. Fold per email limits, the duplicate window, and the quarantine flood cap into the guard. Satisfies AC-7, AC-8, AC-19.
7. Add blocklist lookup by email, domain with subdomain match, and IP hash. Satisfies AC-13.
8. Add the Altcha challenge endpoint, server verification, and the client widget. Satisfies AC-6.
9. Raise the IP limiter to 20 per 15 minutes and set `trust proxy` from the environment. Satisfies AC-9.
10. Add the `isSpam` filter to the ticket list, defaulting to false. Satisfies AC-15.
11. Schedule the daily retention run on server start with a single guard so two runs cannot overlap, and log each run count. Satisfies AC-17.
12. Add the three secrets and `TRUST_PROXY` to `.env.example`, fail fast in production when a secret is missing, and add the guard test suite covering quarantine, reject, and accept verdicts. Satisfies AC-1, AC-2, AC-20.

## Consequences

**Positive**:
- Limits survive restarts and work across instances.
- Every blocked or held submission has a recorded reason, which makes tuning possible.
- A false positive is recoverable because the ticket exists and can be released.
- A bot that passes the honey pot still has to solve proof of work and match content rules.

**Negative / tradeoffs**:
- Two new tables, a scheduled cleanup, and three secrets to manage.
- Every attempt is a database write, so a flood still costs some database work even when it is rejected.
- The 429 duplicate response reveals recent activity for an email address to anyone who submits with it.
- Altcha adds two npm dependencies and a visible widget, which is one more thing that can fail on an old browser.
- The attempt log holds hashed personal data, which needs a retention policy and a deletion path for a privacy request.

**Neutral**:
- The default ticket list changes meaning: spam is now excluded, so anything that counts tickets must decide whether to include it.
- `elapsedMs` disappears from the API, which is a breaking change for any client not in this repository.
- The in memory limiter stays as a first cheap gate, with the database limits behind it.

## Follow-up

- [ ] Add a small operator surface (list, release, block) once the guards have run for a while and the rules are tuned against real data.
- [ ] Decide whether to notify admins when the quarantine flood cap trips, and through which channel.
- [ ] Review the `BANNED_TERMS` and `DISPOSABLE_DOMAINS` lists after one month; they age quickly.
- [ ] Consider a per form override for limits if different forms serve very different audiences.
- [ ] Add a privacy request path that deletes attempt rows by `emailHash`.
- [ ] Add a root `AGENTS.md` so later specs inherit the stack, conventions, and build approach without rediscovery.

## Migration plan

**Strategy**: feature-flagged rollout through a code change, additive schema only.
**Phases**:
1. Deploy the migration: new tables, new ticket columns with defaults, new indexes. No existing column changes, so the old code keeps working.
2. Deploy the server guard and the challenge endpoint, with the new request fields accepted.
3. Deploy the client that sends `formToken` and the proof of work payload.
4. After a week, inspect `FormSubmissionAttempt` verdicts and tune the rules and banned terms.
**Rollback**: revert the client first, then the server, then leave the additive columns and tables in place. No data backfill is needed, so a rollback loses nothing except the attempt history written after the deploy.
**Risks**: a wrong rule quarantines real tickets (mitigated by the default list filter being the only hiding mechanism, plus a review query); a missing secret blocks startup in production (mitigated by failing fast with a clear message); a proxy without `trust proxy` makes the IP limits count the proxy (mitigated by the configuration check).
