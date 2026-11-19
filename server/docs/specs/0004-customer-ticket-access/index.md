# 0004. Customer ticket access links

**Date**: 2026-11-19
**Status**: In Progress

## Summary

Customers who submit a public form can get a private link by email. A link token is a long random string that acts as the credential, and only a hash of it is stored. The link opens one ticket, shows only customer safe details, and lets the customer reply while the ticket is still open. Staff keep their Clerk sign in, can mark notes as internal, and can revoke links from the ticket screen. This adds one database table, a small public API, a customer page in the existing React app, and a few staff controls.

## Requirements

**User stories**:

- As a customer who submitted a public form, I want an emailed link so that I can follow my ticket without creating an account.
- As a customer, I want to add a reply on the page so that I can give more details without writing an email.
- As a staff member, I want internal notes hidden from customers so that I can discuss the ticket safely.
- As an admin or the current assignee, I want to revoke links so that a leaked link stops working.

**Acceptance criteria** (the contract, each criterion is independently checkable):

- **AC-1**: On public form submit, the server creates one access token, emails a link built from `CUSTOMER_PORTAL_BASE_URL` and the raw token, and the page opens only that ticket.
- **AC-2**: A token works for 7 days from issue and can be reused in that window. A revoked, expired or malformed token returns one 404 response with the same message and shows a friendly invalid link screen.
- **AC-3**: The customer view returns ticket number, subject, description, status, priority, type, `createdAt`, `updatedAt`, org name from the linked form with the existing fallback, and every comment with visibility `PUBLIC` or `CUSTOMER`. No `INTERNAL` comment is returned.
- **AC-4**: A customer can post a reply of 1 to 5000 sanitized characters when status is `OPEN`, `IN_PROGRESS` or `ON_HOLD`. The comment is stored with visibility `CUSTOMER` and an author id prefixed with `customer`, and `Ticket.updatedAt` changes.
- **AC-5**: A reply to a `RESOLVED` or `CLOSED` ticket is rejected with 409 and no comment is written.
- **AC-6**: Staff can write comments with visibility `PUBLIC` or `INTERNAL` only. `CUSTOMER` is assigned only by the public reply endpoint. Existing comments keep working as `PUBLIC`.
- **AC-7**: A fresh link is emailed on form submit and on every staff comment with visibility `PUBLIC`. If email fails, the ticket or comment stays saved and the failure is logged.
- **AC-8**: An admin in the ticket org or the current assignee can revoke all unexpired links for a ticket from the ticket details screen. Existing links stop working immediately.
- **AC-9**: Public routes use the global API limit plus a per link limit. Raw tokens are never written to logs. Log lines carry the ticket id and a token hash prefix only.
- **AC-10**: All staff routes keep the current Clerk org checks. A staff member from another org cannot read, revoke or change visibility on the ticket.
- **AC-11**: The customer page carries a no index robots tag and keeps the token on the same origin so it is not sent to third party assets.
- **AC-12**: Tests cover token expiry and revocation, internal note filtering, status gating, sanitization, rate limit keys and staff authorization, using the repo `node:test` style with injected dependencies.

## Decision

**Chosen option**: Expiring emailed access links with a hashed token table.

Customers stay anonymous and prove ownership by holding a link sent to their email inbox. Staff keep their existing Clerk identity and gain only the visibility toggle and link revocation controls.

**Implementation skills**: `prisma-client-api` (`prisma/skills`, `server/.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/skills`, `server/.agents/skills/prisma-cli/`) · `clerk-orgs` (`clerk/clerk`, `client/.agents/skills/clerk-orgs/`)

## Feature design

**Data model sketch**:

| Entity | Field | Type and rule |
|---|---|---|
| `TicketAccessToken` | `id` | `String`, primary key, generated uuid |
| `TicketAccessToken` | `tokenHash` | `String`, unique, sha256 hex of the raw token |
| `TicketAccessToken` | `ticketId` | `String`, required foreign key to `Ticket.id`, cascade delete |
| `TicketAccessToken` | `expiresAt` | `DateTime`, set to 7 days after issue |
| `TicketAccessToken` | `createdAt` | `DateTime`, set on insert |
| `TicketAccessToken` | `revokedAt` | `DateTime?`, null until revoked |
| `TicketAccessToken` | `lastUsedAt` | `DateTime?`, null until first successful use |
| `TicketAccessToken` | index | `@@index([ticketId, expiresAt])` |
| `Comment` | `visibility` | new `CommentVisibility` enum, values `PUBLIC`, `INTERNAL`, `CUSTOMER`, default `PUBLIC` |
| `Comment` | `authorId` | existing `String`, customer replies store `customer:<requesterKey>` |

`Ticket` is unchanged. `Ticket` has many `TicketAccessToken` rows and many `Comment` rows. The raw token is never stored. Where a legacy ticket has no `requesterKey`, the customer author id falls back to `customer:<requesterId>`.

**State transitions**:

Token: issued, active, used, then expired or revoked. A used token stays active until expiry or revocation. Expiry and revocation are terminal.

Ticket: unchanged by this feature. Customer replies are allowed only for `OPEN`, `IN_PROGRESS` and `ON_HOLD`. A reply never moves status.

Comment: staff writes `PUBLIC` or `INTERNAL`. The public reply endpoint writes `CUSTOMER`. Existing rows become `PUBLIC` through the default.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/public/tickets/:token` | GET | raw token in path | ticket basics, org name, visible comments | public token in path | 404 invalid link, 429 limited |
| `/api/public/tickets/:token/replies` | POST | raw token in path, `body` 1 to 5000 characters | created comment | public token in path | 404 invalid link, 409 closed ticket, 422 invalid body, 429 limited |
| `/api/tickets/:ticketId/comments` | POST | existing `body`, new `visibility` of `PUBLIC` or `INTERNAL` | created comment | Clerk session | 403 wrong org, 422 invalid visibility |
| `/api/tickets/:ticketId/customer-links` | DELETE | `ticketId` in path | count of revoked links | Clerk session, admin in org or assignee | 403 denied, 404 missing ticket |
| `/api/public/forms/:publicId/submit` | POST | existing form fields | existing response plus link email side effect | public | 422 invalid form, 429 limited |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| View ticket | raw token and its hash | token path parameter, sha256 derived in the token utility |
| View ticket | ticket number, subject, description, status, priority, type, dates | `Ticket` row found by the token ticket id |
| View ticket | org name | `TicketForm.orgName` joined through `Ticket.formId`, else the `DEFAULT_ORG_NAME` fallback already used by the public form controller |
| View ticket | visible conversation | `Comment` rows for the ticket where visibility is `PUBLIC` or `CUSTOMER`, oldest first |
| View ticket | customer display name | `Ticket.requesterName` |
| View ticket | invalid link message | fixed response defined in this spec, same for malformed, expired and revoked tokens |
| Post reply | comment body | sanitized request `body`, validated to 1 to 5000 characters |
| Post reply | author id | `customer:` plus `Ticket.requesterKey`, else `customer:` plus `Ticket.requesterId` |
| Post reply | comment visibility | forced to `CUSTOMER` by the server |
| Post reply | ticket activity timestamp | Prisma `@updatedAt` on a `Ticket` update |
| Post reply | rate limit key | token hash prefix derived from the path token |
| Issue link | link URL | `CUSTOMER_PORTAL_BASE_URL` plus the raw token |
| Issue link | expiry time | current time plus 7 days, defined in this spec |
| Staff comment | visibility | validated request `body.visibility` limited to `PUBLIC` and `INTERNAL` |
| Revoke links | authorization | Clerk `getAuth` values plus the existing org admin check and ticket `assigneeId` |
| Revoke links | audit fields | actor id from Clerk, ticket id from path, current time for `revokedAt` |

**Key invariants**:

- Only a hash of a token is stored. A raw token appears in the email and the request path only.
- A token grants access to one ticket only. It never grants a ticket list or access to other tickets for the same email.
- A token is usable only while `revokedAt` is null and `expiresAt` is in the future.
- A successful read or reply updates `lastUsedAt`.
- Customer reply visibility and author id are server assigned, never taken from the request body.
- Staff cannot write `CUSTOMER` comments through the staff endpoint.
- Customer requests never carry tenant or org identity from the body. The token resolves the ticket and its org.
- Email failure never rolls back a ticket or comment.

**Security model**:

The link is the credential. Anyone holding an unexpired, unrevoked link can view and reply on that one ticket, which is the accepted tradeoff for an anonymous customer. Public routes sit behind the global request limit and a per link limit. Token values stay out of logs, errors and analytics. The customer page uses a no index robots tag and loads only same origin assets, so the token is not placed in a `Referer` header sent elsewhere. Staff routes keep the existing Clerk session checks. Org membership and the admin role come from Clerk, and the ticket org comes from the database. Revocation is limited to an admin in that org or the current assignee. Ticket bodies, comments and names pass through `sanitizeText`. No regulated compliance scope was confirmed for this slice, though the data includes email addresses and support conversation text.

**Configuration required**:

- `CUSTOMER_PORTAL_BASE_URL`: public origin used to build emailed customer links, for example `https://support.example.com`. Development default is `http://localhost:3000`.

**Critical test scenarios**:

- Happy path: submit the public form, receive a link, open the page, read the ticket, post a reply, verify the new `CUSTOMER` comment and changed timestamp, verifies **AC-1**, **AC-3**, **AC-4**
- Link lifecycle: reuse a link, move the clock past 7 days, revoke a link as staff, verify all invalid states return the same 404 and no ticket data, verifies **AC-2**, **AC-8**
- Privacy: add an `INTERNAL` staff note, verify it never appears in the customer view, verifies **AC-3**, **AC-6**
- State gate: try to reply to a `RESOLVED` ticket and verify 409 with no comment, verifies **AC-5**
- Email failure: make the SMTP send throw and verify the ticket or comment still saves and the log records the failure, verifies **AC-7**
- Auth boundary: a staff user from another org tries to revoke and change visibility, verify 403 and no data change, verifies **AC-10**
- Abuse: send more replies than the per link limit allows, verify 429, and confirm the raw token is absent from logs, verifies **AC-9**
- Test suite: run the new `node:test` files with `npm test --prefix server`, verifies **AC-12**

## Build plan

Project approach is Tracer Bullet, so the first slice carries a thin thread through schema, API, email and page, then later tasks thicken the staff controls and safety details.

1. [x] Add the schema migration for `CommentVisibility`, the `visibility` column with default `PUBLIC`, the `TicketAccessToken` table, its unique hash and its ticket index. Regenerate the Prisma client. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-6**.
2. [x] Build the token utility with random token generation, sha256 hashing, expiry and revocation checks, and hash prefix logging. Add colocated tests with injected clock and crypto. Satisfies **AC-2**, **AC-9**, **AC-12**.
3. [x] Build the customer ticket service and the public GET controller. Resolve the token to one ticket, join the form for org name, filter comments to `PUBLIC` and `CUSTOMER`, and map all invalid links to one 404. Satisfies **AC-1**, **AC-3**, **AC-9**.
4. [x] Build the public reply validator, service and controller. Enforce 1 to 5000 sanitized characters, the status gate, server assigned author id and visibility, the timestamp update, and the per link limiter. Satisfies **AC-4**, **AC-5**, **AC-9**, **AC-12**.
5. [x] Extend `emailService.js` with the access link message and an issue helper. Call it after public form submit and after a staff comment with visibility `PUBLIC`. Log SMTP failures without failing the mutation. Satisfies **AC-1**, **AC-7**.
6. [x] Extend the staff comment path. Add `visibility` to the zod schema, pass it through controller and service, allow only `PUBLIC` and `INTERNAL`, and add the selector to the existing reply box in the ticket details screen. Satisfies **AC-3**, **AC-6**, **AC-10**.
7. [x] Add the revoke route, controller and service call that sets `revokedAt` on unexpired links. Authorize an admin in the ticket org or the assignee, write an audit log line, and add the confirmed revoke control to the ticket details screen. Satisfies **AC-8**, **AC-10**.
8. [x] Build the customer page at `/t/:token` with an action, hook, loading state, ticket view, reply form with a submit guard, friendly invalid link screen, and no index robots tag. Keep every asset on the same origin. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-11**.
9. [x] Wire the routers, per link limiter, global limiter, `CUSTOMER_PORTAL_BASE_URL` in `server/.env.example`, helmet referrer check and CORS review. Update the relevant `AGENTS.md` file lists once code lands. Satisfies **AC-1**, **AC-9**, **AC-11**.
10. Run the server test suite and a manual pass over every acceptance criterion, including cross org denial, email failure and the expired link screen. Fix any gap before handover. Satisfies **AC-12**.

## Consequences

**Positive**:

- Customers get a real web thread without a new login system or Clerk customer accounts.
- Internal staff notes stay private by construction, because the public query filters on visibility.
- Link compromise is contained to one ticket and can be revoked.
- The work reuses the existing SMTP sender, React app, component kit, four layer server pattern and rate limit factory.

**Negative / tradeoffs**:

- A link is a bearer credential. Forwarding it or leaving it in browser history grants access until expiry or revocation.
- Anybody with the link can reply, because no email check or second factor was chosen.
- Replies are not idempotent. A rare double post is accepted. The browser button guard and rate limit are the only protection.
- All visible comments are returned without pagination. A very long thread will grow the response.
- Expired token rows are not cleaned up. Ticket deletion cascades, and other rows remain inert.
- In app notifications are deferred, so staff must open the ticket to notice a customer reply.
- Email failure means the customer may never receive a link, even though the ticket or comment succeeded.
- A staff member who forgets to select internal writes a public comment that customers can see.

**Neutral**:

- The customer page is a new public route in the same app and build.
- Existing comments gain `PUBLIC` visibility through the schema default, with no data script.
- The `customer:<key>` author id is a plain string and does not add a foreign key.

## Follow-up

- [ ] Enroll a scope feature row for customer ticket access and link this spec so its status can track the build.
- [ ] Design in app notifications as a separate feature, including recipients, read state and the existing Notifications page.
- [ ] Add comment pagination when a real thread grows enough to matter.
- [ ] Consider on demand link resend and customer initiated revocation in a later slice.
- [ ] Add an expiry cleanup job if token row volume becomes measurable.
- [ ] Confirm whether GDPR or another data retention rule applies to customer email addresses in tickets, then add a retention decision if needed.

Reasoning and options: see `rationale.md`.
