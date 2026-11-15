# Verify: Omnichannel ticket intake · spec 0002 · updated 2026-10-01
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Sign in as an org admin, open Settings then the Channels tab, add an email channel and a Telegram channel → both appear in the list → AC-8
- [ ] Toggle a channel inactive → the status badge changes to Inactive → AC-8
- [ ] Delete a channel → it is removed from the list → AC-8

## Commands
Set `CHANNEL_SMTP_WEBHOOK_SECRET` and `CHANNEL_TELEGRAM_WEBHOOK_SECRET` first.
- [ ] `POST /api/channels/email/webhook` with a valid body and `x-webhook-secret` → `200` + `ticketId` → AC-1
- [ ] `POST /api/channels/email/webhook` with the same `messageId` again → `200`, no new ticket → AC-5
- [ ] `POST /api/channels/email/webhook` with no or wrong secret → `401` → AC-1
- [ ] `POST /api/channels/email/webhook` with a body missing `messageId` → `400` → AC-1
- [ ] `POST /api/channels/telegram/webhook/:botUsername` with a text message and `X-Telegram-Bot-Api-Secret-Token` → `200` + `ticketId` → AC-2
- [ ] `POST /api/channels/telegram/webhook/:botUsername` with a photo (no text) → `200`, no ticket → AC-9
- [ ] `POST /api/channels/telegram/webhook/:botUsername` with a wrong secret token → `401` → AC-2
- [ ] `POST /api/channels` as admin → `201` → AC-8
- [ ] `PATCH /api/channels/:id` as admin → `200` → AC-8
- [ ] `DELETE /api/channels/:id` as admin → `204` → AC-8
- [ ] `POST /api/channels` as a non-admin → `403` → AC-8

## Value sourcing (behavioral)
- [ ] Email webhook: send an email → ticket `source` is `EMAIL`, `channelRecipient` is the sender from address, `requesterEmail` is the sender, `requesterKey` is a stable hash → AC-1, AC-3, AC-4
- [ ] Telegram webhook: send a text → ticket `source` is `TELEGRAM`, `channelRecipient` is the chat id, `requesterName` is the sender name, `requesterKey` is a stable hash of the user id → AC-2, AC-3, AC-4
- [ ] Reply dispatch: create a comment on a channel ticket as an agent → the reply is sent to `channelRecipient` via the channel's transport (email via SMTP, Telegram via Bot API) → AC-4, AC-7
- [ ] Channel lookup: send an email to an unregistered support address → `200`, no ticket → AC-6

## Acceptance-criteria coverage
- AC-1 email happy path + auth + malformed · AC-2 telegram happy path + auth · AC-3 sender identification both channels · AC-4 reply dispatch · AC-5 dedup · AC-6 one org per channel · AC-7 shared triage/reply pipeline · AC-8 CRUD + admin UI · AC-9 non-text ignored · AC-10 plain text email
