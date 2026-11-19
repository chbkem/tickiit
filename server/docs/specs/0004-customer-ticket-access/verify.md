# 0004. Customer ticket access verification

Run this after the build. Each check names the acceptance criterion it proves.

## Automated checks

- [ ] `npm test --prefix server` passes, including the new token, public route, reply and authorization tests, **AC-12**.
- [ ] Token utility tests prove expiry, revocation and reuse within the window, **AC-2**.
- [ ] Public view tests prove `INTERNAL` comments are never returned and org name falls back when no form is linked, **AC-3**.
- [ ] Reply tests prove sanitization, the 1 to 5000 limit, status gating, server assigned author and visibility, and the timestamp update, **AC-4**, **AC-5**.
- [ ] Staff comment tests prove only `PUBLIC` and `INTERNAL` are accepted, **AC-6**.
- [ ] Authorization tests prove a user from another org cannot revoke or change visibility, **AC-10**.

## Manual checks

- [ ] Submit a public form and confirm the ticket is created and one link email is sent, **AC-1**, **AC-7**.
- [ ] Open the link and confirm the page shows only the expected ticket and its public and customer comments, **AC-3**.
- [ ] Post a reply and confirm it appears as a customer comment with the requester name, **AC-4**.
- [ ] Try to reply to a resolved or closed ticket and confirm the 409 and no new comment, **AC-5**.
- [ ] Write an internal staff note and confirm it is absent from the customer page, **AC-3**, **AC-6**.
- [ ] Send a public staff reply and confirm a fresh link email is sent, **AC-7**.
- [ ] Stop SMTP, send a public reply, confirm the comment saves and the log records the email failure, **AC-7**.
- [ ] Revoke links from the ticket screen, confirm the count returned and that old links show the invalid screen, **AC-8**, **AC-2**.
- [ ] Try an old, malformed and revoked token in turn and confirm the same message and status each time, **AC-2**.
- [ ] Send replies past the per link limit and confirm 429, **AC-9**.
- [ ] Inspect server logs for the whole run and confirm no raw token appears, **AC-9**.
- [ ] View page source and confirm the no index robots tag and no third party asset requests, **AC-11**.
- [ ] Try every staff action as a user from another org and confirm 403, **AC-10**.
