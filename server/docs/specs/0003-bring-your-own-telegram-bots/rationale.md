# 0003. Bring your own Telegram bots, rationale

The decision record for [index.md](index.md). This file is not read during a build.

## Context

Spec 0002 shipped two inbound channels, email and Telegram, and an admin CRUD surface over the `Channel` table. The shape it settled on works for one organization on one instance and stops working at the second one.

The reason is that the table is per bot but the credentials are per instance. `Channel` holds `orgId`, `channel`, and `identifier`, where the identifier for a Telegram row is the bot username, so several rows can point at different bots and look configured. Meanwhile `telegramService.js` reads one `CHANNEL_TELEGRAM_BOT_TOKEN` from the environment for every send, and `channelWebhookAuth.js` reads one `CHANNEL_TELEGRAM_WEBHOOK_SECRET` for every inbound update. There is exactly one real bot behind a table that implies there are many.

Three things follow from that gap, and all three are load bearing for this decision.

First, isolation is fictional. Two organizations can both add a row, both see it as active, and both receive the same replies through the same bot, because the token is not theirs. A token revoked in BotFather stops replies for every organization on the instance at once.

Second, there is a latent data bug that only a multi bot world exposes. `IngestionEvent` is deduped on `@@unique([channel, externalId])`. Telegram numbers messages per chat, not per bot, so with two bots both customers can send their fifth message and the second one is dropped as a duplicate with no error. One bot per instance hides this completely.

Third, the secrets are the wrong shape for the product. They are instance wide operator configuration, while what the product needs is per tenant self service. An organization cannot bring a bot without a redeploy and an operator. That is the actual request behind this spec.

The forces shaping the answer: the credentials have to move to the row, which means the server starts holding customer secrets at rest and needs an encryption key and a rotation story. The inbound URL has to change shape, because a shared secret cannot authenticate a specific bot. The email half of 0002 must not move. And the repository has no test file for the channel code, no migration framework (it uses `prisma db push` plus hand written SQL), and no plan tier, so the design cannot lean on billing limits or a migration runner.

## Options considered

### Option 1: Per channel credentials with server side registration

The token moves onto the Channel row, encrypted. The server calls `getMe` to learn who the bot is and `setWebhook` to point Telegram back at this app. One fixed inbound URL serves every bot and the sender is identified by matching the secret token header.

**Pros**:
- Real isolation, since each organization holds its own credential and one revocation cannot affect another
- No manual Telegram step for the admin, so self service actually works
- Fixes the `message_id` collision, because dedup can scope to the channel
- Health becomes observable, since a failed send can mark one channel as broken

**Cons**:
- The server now holds customer credentials at rest, which is a real new obligation around key management and access
- Rotating the encryption key means asking admins to re-paste tokens
- Deleting a bot destroys the token irrecoverably
- Fixed webhook URL means two deployments cannot both claim one bot

### Option 2: Keep credentials in the environment, one bot pair per organization

Each organization is configured by an operator who adds a token and a secret to the deployment environment, with a map from bot username to token.

**Pros**:
- No secrets in the database, so the security posture is unchanged from today
- Nothing to encrypt and no key to rotate
- Smallest change, mostly confined to config and lookup

**Cons**:
- Still not bring your own. Adding an organization is a deploy and an operator, which is exactly what is being asked to remove
- Configuration drifts from the Channel table, which becomes a list of usernames that cannot be verified
- Secret sprawl, since every new tenant means new environment variables and a restart
- The `message_id` collision is not addressed, because the dedup key is untouched

### Option 3: Delegate to a hosted channel layer

Put a provider such as a chat platform service in front of Telegram and hold one integration instead of many.

**Pros**:
- No Telegram credential handling at all, the provider owns bot tokens
- Adds channels beyond Telegram without more per channel work
- Provider absorbs Telegram API changes

**Cons**:
- Breaks the rule in the project AGENTS.md about preferring what the platform already runs. The repo owns auth, storage, and pipelines directly, and Clerk is the one external dependency
- Introduces a vendor holding every customer conversation, which is a larger commitment than the problem needs
- Adds a billing and plan tier conversation the project does not have
- Costs a dependency and an outage surface to solve a problem that is about fifty lines of crypto and three Telegram calls

### Option 4: Poll Telegram instead of using webhooks

Register no webhook and poll `getUpdates` per bot on a timer.

**Pros**:
- No public https URL needed, which removes the reverse proxy requirement
- No webhook secret, so nothing to store or compare

**Cons**:
- Telegram's polling is strictly single consumer per bot, so two instances steal each other's updates and delivery becomes a race
- Requires a long running worker per bot, and this project has no queue yet, as `AI_LAYER_PLAN.md` is still intent
- Delivery latency becomes the poll interval instead of immediate
- Fixes nothing about credential isolation, which is the actual complaint

## Rationale

Option 1 is the answer because it is the only option that delivers what was asked for. Bring your own bot means the customer's credential lives with the customer's channel row, and options 2 and 4 both leave a shared secret in the environment while merely widening the table around it. Option 3 would work and would hand the problem to a vendor, but it trades a self contained problem for a dependency, a data processor, and a commercial relationship the project has no reason to take on yet.

The specific shape choices follow from the same logic. Encrypting on the row rather than in a secrets manager is the right call at this size: `node:crypto` ships with the Node 18 runtime the project already requires, `aes-256-gcm` gives authenticated encryption so a tampered row fails to decrypt rather than sending garbage to Telegram, and there is no network hop in the send path. A secrets manager would add an outage surface and an availability dependency to a feature that a small team operates.

Registering the webhook from the server, rather than showing a URL for the admin to paste into BotFather, follows directly from the admin only, no operator constraint. If the admin has to touch Telegram settings, the feature is not self service, and every deployment that moves the URL breaks intake silently.

The fixed inbound URL with per channel secrets is chosen over keeping the bot username in the path. The path form was survivable with one shared secret because the secret did not identify anything. Once every bot has its own secret, the secret is the identifier, and carrying a second identifier in the URL adds a moveable part that breaks when an admin renames a bot. It is also what makes reclaiming a webhook sensible: the server knows which bot it is registering, so a bot already pointed at an old deployment can be taken over and the admin can be told.

The `NEEDS_SETUP` status exists for one reason: existing rows have a username and no token, and they must not look configured. That status is the difference between an admin learning on day one that they need to paste a token and learning on day thirty from a customer.

One thing this spec deliberately does not do is fix the reply failure story. Skipping the send and logging it is what the code does today and it is preserved, so an agent's comment never fails because Telegram did. The improvement is that the channel now reads `ERROR` in the dashboard, which is where the visibility belongs without putting a retry queue into a feature that has no queue infrastructure yet.

## Evidence

Current state, read directly rather than inferred, for the claim that the table is per bot and the credentials are per instance:

| Concern | File and line | What it does |
|---|---|---|
| One token, every send | `server/src/services/telegramService.js:12` | Reads `process.env.CHANNEL_TELEGRAM_BOT_TOKEN`, skips the send if unset |
| One secret, every inbound | `server/src/middleware/channelWebhookAuth.js:39` | Compares `X-Telegram-Bot-Api-Secret-Token` against one env value |
| Per bot rows already exist | `server/prisma/schema.prisma:75` | `Channel` with `@@unique([orgId, channel, identifier])` |
| The collision | `server/prisma/schema.prisma:95` | `IngestionEvent @@unique([channel, externalId])` |
| Username in the path | `server/src/routes/channels.js:41` | `POST /telegram/webhook/:botUsername` |
| Manual setup today | `client/src/components/settings/channels-tab.jsx` | An admin types a bot username, nothing calls Telegram |
| Invariant being reversed | spec 0002 `index.md` line 95 | "Channel secrets (bot token, SMTP credentials) are never stored in the database; they live in environment variables." |