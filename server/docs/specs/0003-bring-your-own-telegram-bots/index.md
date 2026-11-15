# 0003. Bring your own Telegram bots

**Date**: 2026-10-02
**Status**: In Progress

## Summary

Today the Channel table has one row per Telegram bot, but the credentials behind those rows live in environment variables that the whole instance shares. So any organization that connects a bot is really borrowing one bot that everyone else is also using, and one revoked token breaks intake for all of them.

This spec moves the credentials onto the row. Each bot gets its own token, stored encrypted, plus its own webhook secret, its own health status, and its own reply path. An admin pastes a token, the server asks Telegram who that bot is and points Telegram back at this app, and there is no manual step left in BotFather.

It supersedes the Telegram configuration section of [0002](../0002-omnichannel-ticket-intake/index.md). Email intake is unchanged by this spec.

## Requirements

**User stories**:
- As an org admin, I want to connect my own Telegram bot so that my customers write to my bot and not to a shared one.
- As an org admin, I want to see that my bot is connected and working so that I find out when it is not.
- As an org admin, I want to replace a token that was revoked so that I can recover without losing my ticket history.
- As an agent, I want my reply to go out through the same bot the customer wrote to so that the customer gets it where they asked.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: An org admin pastes a Telegram bot token; the server calls `getMe`, and the channel is stored with the bot's real numeric id and username from Telegram, not typed by hand
- **AC-2**: On connect and on every token replacement, the server calls `setWebhook` with the deployment's public URL and a per channel secret token, so intake works without any manual step in BotFather
- **AC-3**: Bot tokens are stored per channel, encrypted at rest, and never returned by any API
- **AC-4**: Inbound updates are authenticated against the secret of the specific bot that sent them, and the bot is resolved by its numeric id rather than by a URL path segment
- **AC-5**: Replies on a Telegram ticket are sent with that ticket's own bot token
- **AC-6**: An admin can send a test message through the bot to a chat id they supply, and the send result is reported
- **AC-7**: Private chat text messages create tickets; group chats and non text messages create none
- **AC-8**: Slash commands create tickets like any other text
- **AC-9**: Each channel carries its own status and last error, updated on every send, and the dashboard shows it
- **AC-10**: Existing Telegram channels from the env var setup keep working for inbound and read as needing setup until a token is pasted
- **AC-11**: An org admin can list, pause, resume, rotate the token on, and delete a Telegram bot channel; the token is write only
- **AC-12**: Two bots in different orgs can each receive `message_id` 5 and both create a ticket

## Decision

**Chosen option**: Option 1: per channel credentials with server side registration.

The token moves from an environment variable onto the Channel row, encrypted with `node:crypto` and an `aes-256-gcm` cipher. The server calls `getMe` and `setWebhook` itself, so an admin pastes one field and nothing else. One fixed inbound URL serves every bot, and the bot is found by matching the `X-Telegram-Bot-Api-Secret-Token` header against each channel's own secret.

**Implementation skills**: `prisma-client-api` (`prisma/prisma`, `server/.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/prisma`, `server/.agents/skills/prisma-cli/`)

**Out of scope**: email intake and SMTP configuration, group chats, bot commands such as `/start`, attachments, a scheduled health check, per tenant limits on bot count, and any change to the AI triage pipeline.

## Feature design

**Data model sketch**:

The Channel model gains eleven nullable columns and a status. Every one of them is null on an email row and that is the marker meaning "this is not a Telegram channel". There is no new table for Telegram credentials, so the existing CRUD service, routes, and dashboard table keep working.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `identifier` | `String` | no | The bot username as Telegram reports it, falling back to `bot<numeric id>` when Telegram reports none. Existing meaning, unchanged for email. |
| `displayName` | `String` | yes | The bot's first name, so the dashboard can say My Support Bot. |
| `telegramBotId` | `String` | yes | The numeric bot id from `getMe`, stored as a string. Globally `@unique`. |
| `botTokenCiphertext` | `String` | yes | The encrypted token. |
| `botTokenIv` | `String` | yes | The initialisation vector for that encryption. |
| `botTokenAuthTag` | `String` | yes | The GCM authentication tag, stored apart from the ciphertext so a tampered row fails to decrypt. |
| `webhookSecret` | `String` | yes | Random per channel secret Telegram echoes back in the header. Plain, not encrypted. |
| `status` | `ChannelStatus` | no, default `NEEDS_SETUP` | The health of the bot. |
| `statusMessage` | `String` | yes | The last error, in plain words, safe to show an admin. |
| `statusCheckedAt` | `DateTime` | yes | When the status was last written. |
| `isActive` | `Boolean` | no, default `true` | The manual pause, unchanged from 0002. |

New enum `ChannelStatus`: `NEEDS_SETUP`, `PENDING`, `ACTIVE`, `ERROR`.

IngestionEvent changes shape. `channelId` is added and becomes required, and the old unique pair on `(channel, externalId)` is replaced by a unique pair on `(channelId, externalId)`. This is what makes AC-12 hold: Telegram numbers messages per chat, so two bots will both hand you a `message_id` of 5 and the old key would have dropped the second one silently. The `channel` column stays for reporting.

Ticket gains `channelId`, nullable, with `onDelete: SetNull`, so a deleted bot keeps its ticket and its comment thread.

A third table is new: `ChannelAudit`, holding `id`, `channelId` (nullable, no foreign key, so the record survives the channel being deleted), `orgId`, `botUsername`, `action` from the enum `ChannelAuditAction { CONNECT, ROTATE, DELETE }`, `actorId` (the Clerk user id), and `createdAt`. No token, ever.

Constraints, in full:

- `telegramBotId` is globally `@unique`. One bot serves exactly one organization across the whole instance, so two tenants can never fight over one bot.
- `@@unique([orgId, channel, identifier])` stays as it is, giving one bot username per organization. A bot with no Telegram username gets `bot<numeric id>` as its identifier, which is unique because the numeric id is.
- `@@unique([channelId, externalId])` on IngestionEvent.
- Token columns are null on email rows, enforced as an application rule rather than a database one, since Postgres check constraints are not expressed in the Prisma schema this project uses.
- `webhookSecret` is never returned by any route. Registration is automatic, so no admin ever needs to read it.

**State transitions**:

| From | To | Trigger |
|---|---|---|
| (new row) | `NEEDS_SETUP` | Created with no token, which is what the migration does to existing rows. |
| `NEEDS_SETUP` | `PENDING` | An admin pastes a token. |
| `PENDING` | `ACTIVE` | `getMe` and `setWebhook` both succeed. |
| `PENDING` | `ERROR` | `getMe` or `setWebhook` failed. The channel is still saved. |
| `ACTIVE` | `ERROR` | A send or verify came back 401 or 404, meaning the token was revoked. |
| `ERROR` | `PENDING` | An admin rotates the token. This is the recovery path. |
| `ERROR` | `ACTIVE` | Any later successful send. |

`isActive` is independent of all of this and remains the admin's manual pause. A paused channel matches no inbound update and sends no reply, while keeping its status and token.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| /api/channels/telegram/webhook | POST | Telegram Update object (req) | 200 `{ ok: true }` | per channel `X-Telegram-Bot-Api-Secret-Token` | 400 malformed, 401 unknown or wrong secret |
| /api/channels | GET | none, org from the session | `Channel[]`, serialized, each with `tokenMask` and `status` | org admin | 403 not admin |
| /api/channels | POST | `channel`: TELEGRAM (req), `botToken`: string (req) | `Channel`, plus `reclaimedWebhook` boolean | org admin | 400 bad token shape, 400 Telegram rejected the token, 403, 409 that bot id already belongs to another org |
| /api/channels/:id/telegram/token | POST | `botToken`: string (req) | `Channel`, plus `reclaimedWebhook` boolean | org admin | 400 bad token shape, 400 Telegram rejected the token, 400 not a Telegram channel, 403, 404 |
| /api/channels/:id/test | POST | `chatId`: string (req) | `sent` boolean, Telegram `messageId` | org admin | 400, 403, 404, 422 no token stored yet, 502 Telegram rejected the send |
| /api/channels/:id | PATCH | `isActive`: boolean (req) | `Channel` | org admin | 403, 404 |
| /api/channels/:id | DELETE | none | 204 | org admin | 403, 404 |

The email webhook and the email half of the channel CRUD are untouched. `POST /api/channels` and `POST /api/channels/:id/telegram/token` are two routes calling one service function, so verification and registration are written once.

Every channel route returns rows through a single `serializeChannel` helper, which strips `botTokenCiphertext`, `botTokenIv`, and `botTokenAuthTag` and adds `tokenMask`. Because every route goes through it, there is no per route place where an omitted column leaks the token. `tokenMask` is null when `botTokenCiphertext` is null, so a channel that still needs setup reports no mask rather than an empty one.

The inbound zod schema needs `message.chat.type` added, since the current `telegramWebhookSchema` in `channelSchemas.js` does not carry it and the private chat filter depends on it.

Reply dispatch resolves `Ticket.channelId`. When it is null, the send is skipped and logged rather than thrown, which covers both web tickets and tickets whose channel row was deleted. Web tickets never reach the transport at all because `channelRecipient` is null.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Connect a bot | `telegramBotId` | Telegram `getMe` response, `result.id` |
| Connect a bot | `identifier` | Telegram `getMe` response `result.username`, falling back to the string `bot` plus `result.id` when Telegram reports no username |
| Connect a bot | `displayName` | Telegram `getMe` response, `result.first_name` |
| Connect a bot | `botTokenCiphertext`, `botTokenIv`, `botTokenAuthTag` | Derived from the request body `botToken` by `encryptSecret` |
| Connect a bot | `webhookSecret` | Generated by the server, 32 random characters |
| Connect a bot | webhook URL passed to `setWebhook` | `CHANNEL_PUBLIC_BASE_URL` env plus the fixed path `/api/channels/telegram/webhook` |
| Connect a bot | `orgId` | Clerk session via `getAuth`, never a body field |
| Connect a bot | `reclaimedWebhook` | `getWebhookInfo` called before registering; true when the current URL is non empty and differs from ours. Telegram's `setWebhook` response carries no such field |
| Rotate a token | all of the above | Same sources; `orgId` from the session, the row from the `id` param |
| Inbound update | which bot sent it | `X-Telegram-Bot-Api-Secret-Token` header matched against `Channel.webhookSecret` |
| Inbound update | `channelId`, `orgId` | The matched Channel row |
| Inbound update | `externalId` | `message.message_id` from the request body |
| Inbound update | is it a private chat | `message.chat.type` from the request body, must equal `private`. `group`, `supergroup`, and `channel` are all rejected |
| Inbound update | `channelRecipient` | `message.chat.id`, stored as a string |
| Reply dispatch | which token | `Ticket.channelId` to Channel, then decrypt `botTokenCiphertext`. A null `channelId` means skip and log |
| Reply dispatch | reply text | `Comment.body` |
| Test send | `chatId` | Admin supplied request body field |
| Any channel read | `tokenMask` | Derived from the stored token, the bot id prefix plus the last three characters, and null when `botTokenCiphertext` is null |
| Any channel read | `status`, `statusMessage`, `statusCheckedAt` | DB columns, written by the send and verify paths |
| Audit row | `actorId` | Clerk session via `getAuth` |

No value on this list is left for the build to invent.

**Key invariants**:

- A bot token never leaves the server. No route, no error body, and no log line carries the ciphertext, the iv, the auth tag, or the plaintext token.
- One bot id belongs to one organization, enforced by a global unique index.
- One message from one bot creates at most one ticket, enforced by the IngestionEvent unique pair.
- A channel with no decryptable token matches no inbound update and sends no reply.
- Group chats and non text messages create no ticket.
- Email rows carry null in every Telegram column and behave exactly as they did under 0002.

**Security model**:

- Connect, rotate, test, pause, and delete are org admin only, reusing the existing `ADMIN_ROLES` check in `clerkService.js`. A bot token is a credential, so a non admin member of the organization cannot see or change one.
- Inbound authentication is a constant time compare of the `X-Telegram-Bot-Api-Secret-Token` header against the stored secret, the same `safeEqual` helper `channelWebhookAuth.js` already uses. An unknown secret is 401. No bot id is trusted from the URL or the body.
- Tokens are encrypted at rest with `aes-256-gcm` from `node:crypto`, key from `CHANNEL_ENCRYPTION_KEY`. Authenticated encryption means a modified row fails to decrypt rather than producing garbage that gets sent to Telegram.
- The inbound auth secret and the outbound bot token are different secrets with different jobs. A stolen `webhookSecret` only lets someone post fake updates. A stolen bot token grants the ability to send as the bot. They are stored and handled separately for that reason.
- Logs carry the channel id, the organization, the bot username, and Telegram error bodies truncated to a short length. They never carry a token. Truncation matters because Telegram error bodies can echo the chat id and customer details.
- Chat ids stay in plain on `Ticket.channelRecipient`, consistent with 0002 and with the rest of the model. The bot token is what grants access; the chat id on its own is not the secret.
- Connect, rotate, and delete each write a `ChannelAudit` row naming the acting Clerk user. There is no plan tier in this project, so no cap on bots per organization is enforced.
- Rate limiting is unchanged: the existing `webhookLimiter` on the inbound route and `writeLimiter` on admin writes.
- No named compliance scope. The database stores credentials and customer contact identifiers and is internal.

**Configuration required**:

- `CHANNEL_ENCRYPTION_KEY`: 32 bytes for `aes-256-gcm`, encoded as base64 and nothing else. Startup base64 decodes it and fails when the decode fails or the result is not exactly 32 bytes. An instance without a usable key cannot accept a token at all. A key that is present and well formed but different from the one that encrypted existing rows is a separate case: startup succeeds, and a startup sweep marks every channel it cannot decrypt as `ERROR` with a message saying the key changed. Those channels are recovered by an admin rotating the token, so nothing is lost.
- `CHANNEL_PUBLIC_BASE_URL`: the public https origin for this deployment, for example `https://support.example.com`. Used to build the webhook URL handed to `setWebhook`. Unset or not https is a startup failure for the same reason.
- Removed: `CHANNEL_TELEGRAM_BOT_TOKEN`, `CHANNEL_TELEGRAM_WEBHOOK_SECRET`, `CHANNEL_TELEGRAM_WEBHOOK_URL`. Every bot is bring your own, and there is no shared fallback.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):

- Happy path: an admin pastes a token, `getMe` returns bot 777 and the username, the token is encrypted, `setWebhook` is called with the public URL and the new secret, and the channel reads `ACTIVE` with a masked token and no secret in the response. Verifies **AC-1**, **AC-2**, **AC-3**.
- Happy path: a private text message reaches the fixed webhook URL with the right secret, creates a ticket through `runTriage` with `source` TELEGRAM and `channelId` set, and an agent comment goes out through that bot's own token. Verifies **AC-5**, **AC-7**, **AC-8**.
- Failure case: two channels in two organizations each receive `message_id` 5 and both create a ticket. Verifies **AC-12**.
- Failure case: `getMe` rejects a pasted token, the channel is saved as `ERROR` with a readable message, and no ciphertext is left behind in a half written state. Verifies **AC-1**, **AC-9**.
- Failure case: a revoked token makes a send return 401, the send is skipped without throwing, the agent comment still saves, and the channel reads `ERROR`. Verifies **AC-5**, **AC-9**.
- Failure case: a group chat message and a photo are both ignored and return 200 so Telegram does not retry. Verifies **AC-7**.
- Failure case: `setWebhook` finds the bot already pointed at an old deployment, `getWebhookInfo` reported that URL beforehand, the server reclaims it, and the response says so. Verifies **AC-2**.
- Auth/permission: a non admin org member gets 403 on connect, rotate, and test. Verifies **AC-11**.
- Auth/permission: an inbound update with an unknown secret gets 401 and creates no ticket. Verifies **AC-4**.
- Migration: an existing channel row with a username and no token reads `NEEDS_SETUP`, still matches inbound, and becomes `ACTIVE` once a token is pasted. Verifies **AC-10**.

## Build plan

The build approach for this project is Tracer Bullet, from the scope board header. Applied here that means the thinnest working path first: an admin pastes a token and one message flows in and a reply flows out, with nothing else. Health reporting, rotation, the audit trail, and the dashboard polish land after that path is proven.

**Slice 1: one bot, end to end**

- [x] 1. Additive schema change: the eleven Channel columns, the `ChannelStatus` and `ChannelAuditAction` enums, the `ChannelAudit` table, nullable `Ticket.channelId` and `IngestionEvent.channelId`, the global unique on `telegramBotId`, and the new IngestionEvent unique pair. Satisfies **AC-3**, **AC-12**.
- [x] 2. Backfill script `prisma/sql/backfill-channel-links.sql` resolving `channelId` for existing IngestionEvent and Ticket rows by identifier. An event that cannot be resolved gets its own dedicated placeholder channel row rather than a shared one, because two unresolvable events can share a `message_id` and a single shared placeholder would collide with the new unique pair. Satisfies **AC-12**.
- [x] 3. `encryptSecret` and `decryptSecret` in `src/utils/` using `node:crypto` `aes-256-gcm`, plus the startup config check for `CHANNEL_ENCRYPTION_KEY` and `CHANNEL_PUBLIC_BASE_URL` and the decrypt sweep. Satisfies **AC-3**.
- [x] 4. Telegram API client in `src/services/telegramService.js`: `getMe`, `getWebhookInfo`, `setWebhook`, and `sendMessage`, each with a five second timeout. Satisfies **AC-1**, **AC-2**, **AC-6**.
- [x] 5. Channel service additions: connect and rotate as one shared function, `serializeChannel` with the token mask, lookup by webhook secret, and the status stamping helper. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-9**.
- [x] 6. Fixed inbound route `POST /api/channels/telegram/webhook` with per channel secret authentication, the private chat and text filters, and `channelId` set on the created ticket. Satisfies **AC-4**, **AC-7**, **AC-8**, **AC-12**.
- [x] 7. Reply dispatch reads `Ticket.channelId`, decrypts that channel's token, and sends through it. Satisfies **AC-5**.

**Slice 2: recovery and visibility**

- [x] 8. Rotate endpoint, the error stamping on send failures, and the `ChannelAudit` writes on connect, rotate, and delete. Satisfies **AC-9**, **AC-11**.
- [x] 9. Test send endpoint with the chat id in the body, reporting the Telegram result. Satisfies **AC-6**.
- [x] 10. Existing Telegram rows set to `NEEDS_SETUP`, the deprecated per bot webhook route kept alive for one release, and the three Telegram env vars removed from `.env.example` and the code. Satisfies **AC-10**.

**Slice 3: the dashboard**

- [x] 11. Rework `channels-tab.jsx`: the Telegram form takes a token with a collapsible BotFather help block, the table grows a status column and the masked token, each bot row gets a test button that prompts for a chat id, and an `ERROR` row shows its message. Satisfies **AC-1**, **AC-6**, **AC-9**, **AC-11**.

**Two deviations from this spec, both recorded by /develop and open to /architect:**

1. **The old `IngestionEvent` unique pair on `(channel, externalId)` was dropped in this build, not in phase 4.** The plan above deferred it, but **AC-12** cannot hold while it exists: two bots in two organizations both receive `message_id` 5, and the old pair rejects the second as a duplicate. The data model section already describes the pair as *replaced*, so the schema now carries only `@@unique([channelId, externalId])`. `IngestionEvent.channelId` stays nullable until phase 4, since the backfill cannot prove a link for every row.
2. **The backfill resolves `channelId` through the linked ticket, not "by identifier".** Neither `IngestionEvent` nor `Ticket` stores a channel identifier, so there was nothing to join on. The rule shipped is: event to its ticket to that ticket's organization, then that organization's channel of the same type, and only when the organization has exactly one such row. An ambiguous or unlinked row is left null and counted as unresolved rather than guessed at. `/architect` should confirm this is the intended reading before phase 4 makes the column required.

## Migration plan

**Strategy**: additive schema change with a hand run backfill, then code, then tightening. This project uses `prisma db push` and hand written SQL in `prisma/sql/`, not migration files, so the plan follows that shape rather than inventing a migration framework.

**Phases**:
1. Additive schema, all new columns nullable, run `npm run prisma:generate --prefix server` then `npm run prisma:push --prefix server`.
2. Run `npx prisma db execute --file prisma/sql/backfill-channel-links.sql`. Check the row counts it reports against the pre migration counts before moving on.
3. Deploy the code. The new fixed webhook route goes live. The old route `POST /api/channels/telegram/webhook/:botUsername` stays alive for one release behind the existing global secret, so bots that are still pointed at it keep delivering while admins reconnect them.
4. Tighten: make `IngestionEvent.channelId` required, drop the old unique pair on `(channel, externalId)`, delete the deprecated route and the global secret middleware, and remove the three Telegram env vars.

**Rollback**: phases 1 and 2 are additive, so reverting the code before phase 4 leaves harmless extra columns and backfilled values. Phase 4 is the only destructive step and reverses by re-adding the dropped index and restoring the old route.

**Risks**:
- An IngestionEvent row whose channel cannot be resolved by identifier would fail the phase 4 unique constraint. The backfill creates a placeholder channel row precisely so no history is dropped, and phase 4 runs only after phase 2 has been checked.
- Existing Telegram channels have no stored token, so they read `NEEDS_SETUP` and an admin must paste a token before they can send replies. This is the intended change and it is visible in the dashboard rather than silent.
- Every existing bot must have its webhook re-registered under the new fixed URL. The deprecated route in phase 3 is what stops that from being an outage; if it is removed too early, every pre-existing bot goes dark without an error anyone sees.

## Consequences

**Positive**:
- An organization's bot belongs to it. One org cannot disturb another's intake.
- A revoked token affects one channel and is visible in the dashboard, instead of silently dropping replies for everyone on the instance.
- No knowledge of BotFather webhook setup is needed. One field is pasted and the rest is done by the server.
- Two bots can no longer collide on the same `message_id`.

**Negative / tradeoffs**:
- The server now holds customer credentials at rest, which it did not before. That is a new security obligation: the encryption key, its rotation, and access to the database all matter more than they used to.
- Rotating the encryption key requires an admin to re-paste tokens. The sweep marks the damage clearly, but it is manual work.
- Deleting a bot destroys the token irrecoverably. Anyone still holding it in BotFather keeps it, and the tickets that pointed at it lose the link to its row, which means replies on those tickets can no longer be sent at all. Pausing instead of deleting keeps the token and the link.
- The webhook URL is fixed now, so two deployments cannot both point the same bot at themselves. That is correct, but it means a preview environment and production compete for one bot.
- Outbound Telegram calls are now on the request path of every Telegram reply, with a five second bound each. That ceiling already applied through one token and now applies per bot.
- Nothing is queued. A Telegram outage during a reply means the customer does not get it and the only trace is a log line.

**Neutral**:
- Two new tables or models in effect: `ChannelAudit`, plus eleven columns on Channel. One new enum and one new small enum.
- Three environment variables added, three removed.
- The email path is unchanged and carries null in every new column.
- One more route shape on the inbound side and one deprecated route kept for a release.

## Follow-up

- [ ] Remove the deprecated `POST /api/channels/telegram/webhook/:botUsername` route, the global Telegram secret middleware, and the `ChannelStatus` backfill tooling once every pre-existing bot has been reconnected under the fixed URL
- [ ] Consider a scheduled `getWebhookInfo` check so a bot whose webhook was deleted in Telegram shows as broken before an admin notices a customer complaining
- [ ] Consider whether a rotated `CHANNEL_ENCRYPTION_KEY` deserves a scripted re-paste path rather than an admin doing it per channel
- [ ] Consider the same per tenant credential shape for email sending, so SMTP credentials are not shared either
- [ ] Consider attachments on Telegram messages, currently out of scope
- [ ] Fix the broken spec link in `docs/scope/scope.md`, where the omnichannel row points at `../specs/0002-omnichannel-ticket-intake.md` and should point at the directory's `index.md`

Reasoning and options: see [rationale.md](rationale.md).