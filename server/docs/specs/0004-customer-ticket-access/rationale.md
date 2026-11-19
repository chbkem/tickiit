# 0004. Customer ticket access links, reasoning

## Context

> ⚠️ Premise note: This is one buildable feature with several sub decisions, and it relies on staff auth and org isolation that exist in code but have no separate spec. The assumptions are stated below and in the build spec. Notification delivery, attachments, ticket reopening and customer accounts are deliberately outside this slice.

Customers can submit a ticket through the public form at `/f/:publicId`. The server stores the email as a deterministic `requesterKey` and sends a confirmation email, but the customer has no way to see the ticket or continue the conversation on the web. Staff, meanwhile, work behind Clerk sign in, and every ticket and comment route assumes a Clerk session with an active org.

The feature must close that gap without creating customer accounts. A customer account path would need user provisioning, role design, invites or sign up, and a way to tell customer users from staff users in an org. The public form already has a verified email address at submission time, so an emailed credential is a natural fit.

Safety is the main force. The link grants access to support conversation text and customer names. It must not expose other tickets, internal staff notes or another tenant's data. It must also fail in a boring way when email is down, when a link is old, or when a link is revoked. The repo has no notification backend, no background job system and no customer identity table, so the design keeps to one table, one new env var, the existing SMTP sender and the existing React build.

## Options considered

### Option 1: Emailed expiring access links

The server generates a random token, stores only its hash against the ticket, and emails a link that works for 7 days. Staff issue a fresh link on every public reply. Revocation is a timestamp on the row.

**Pros**:

- No customer account, password or new auth provider.
- Fits the existing public form and SMTP sender.
- Compromise is contained to one ticket and can be ended immediately.

**Cons**:

- The link is a bearer credential and can be forwarded.
- Email failure leaves the customer without web access.
- A customer who loses the link has no self service recovery in this slice.

### Option 2: Clerk customer accounts

Create a Clerk user for each customer, give them a customer role, and let them sign in with Clerk to see all their tickets.

**Pros**:

- Strong identity and a durable customer list.
- Customers can change email and recover accounts through Clerk.
- One auth system for staff and customers.

**Cons**:

- Needs user provisioning, role mapping and careful separation from org staff roles.
- Much larger build than the first slice.
- Customers who only want one answer are forced into an account.

### Option 3: Ticket number plus email and a one time code

The customer enters their ticket number and email on the portal, then types a short code sent by email.

**Pros**:

- No long link to forward by accident.
- Works when an email client strips links.

**Cons**:

- Adds a form step, code storage and a mismatch error case.
- Still depends on the same email inbox, so it adds work without adding a factor.

### Option 4: Permanent private link

Email one link that never expires unless revoked.

**Pros**:

- Simplest possible flow and no expiry screen.

**Cons**:

- A leaked link works forever if nobody notices.
- Old links for closed tickets keep granting access with no natural end.

## Rationale

The engineer chose emailed expiring links, and that fits the actual constraint: customers are anonymous form submitters with an email address on the ticket. Clerk already serves staff, and stretching it to customers would add accounts and roles that this slice does not need. A hashed random token with an expiry and a revocation timestamp is a plain, well understood pattern that the team can operate with the existing database and SMTP setup.

A 7 day reusable window was chosen because support threads can pause for a weekend or two. A single use token would need a browser session and CSRF handling, which adds a second security mechanism for little gain here. A permanent link was rejected because forwarding is common in support, and a permanent credential has no natural end.

Visibility was chosen as an enum with `PUBLIC`, `INTERNAL` and `CUSTOMER` after the engineer selected it over a plain boolean. It gives the customer query one clear filter and leaves room for automated comments later. The tradeoff is a default value on every existing row and a server rule that stops staff from writing `CUSTOMER` comments.

Staff notification was explored and deliberately left out. There is no notification table or API in the server today, so building it would double the size of this slice. The engineer confirmed that a `CUSTOMER` comment on the ticket is enough for now. This is a scope decision, not a claim that notifications are unimportant.

Two generic defaults were consciously overridden by the engineer. Comments are returned without pagination because threads here are small and no pagination exists today. Replies are not idempotent because the cost of a rare duplicate support message is lower than the cost of a key store and replay handling. Both are recorded as follow ups so they are revisited with evidence rather than forgotten.

No References section was requested for this spec, so the reasoning above stands on the repository conventions and the answered design questions only.
