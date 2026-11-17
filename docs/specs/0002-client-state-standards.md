# 0002. Standardise client loading, error, success and empty states

**Date**: 2026-11-17
**Status**: Accepted

## Summary

This decision sets one pattern for every state in the client app. A data view shows a tailored skeleton on first load, a friendly message with a manual retry when a request fails, a distinct view when there is no data or no filter match, and content when ready. The landing page hides auth labels and shows a small spinner while Clerk is loading, and the dashboard shell keeps its layout while a protected route resolves. The rollout builds the shared pieces first, then migrates screens in slices starting with the home page.

## Context

The client has all the right pieces, but each screen uses them differently. The landing page passes `loading={!isLoaded}` to `Button`, yet `Button` shows both a spinner and the label, and the mobile menu toggle has no loading state at all. The protected dashboard route uses `Show when="signed-in"`, which gives the user no visible feedback while Clerk resolves.

The data screens disagree with each other. `ticket-list.jsx` has a skeleton table, an error banner with retry, and separate empty states for no data and no filter match. `forms.jsx` uses a plain spinner, an inline retry block, and several empty states. `public-form.jsx` has a spinner, an error card, and a dedicated success screen with a ticket number. `create-ticket.jsx` only changes its label to "Creating...", `edit-ticket.jsx` prints plain text "Loading..." and logs failures to the console, and the notification and settings routes are static empty states.

This mix has real costs. Users see blank flashes when auth resolves, layout jumps when content appears, raw error strings on some screens, and no clear next action when a request fails. A new screen has no rule to follow, so the inconsistency keeps growing.

The work is client only. The stack is React 18 with Create React App, Tailwind, Clerk for auth, and react hot toast for action feedback. CI already runs client tests and a client build. There is no scope row for this work and no project context file, so this is a standalone standard. No data model, endpoint, secret or new dependency is needed. This checkout is currently 11 commits behind `origin/main`, so the work should start after a pull or rebase.

## Requirements

**User stories**:
- As a visitor, I want the home page to tell me auth is loading without showing buttons I cannot use yet.
- As an agent, I want data views to hold their shape while loading and to tell me exactly what went wrong when they fail.
- As an agent, I want empty results to tell me whether I have no data or too many filters.
- As a customer, I want a clear confirmation when my request is accepted, with the ticket number I need to keep.

**Acceptance criteria** (the contract, each criterion is independently checkable):
- **AC-1**: While Clerk is not loaded, every auth driven control on the landing page shows a small spinner with no visible label. This covers the header Sign in, the header Get started, the hero Get started, the final call to action Get started, the header Dashboard button and UserButton. GitHub links stay active.
- **AC-2**: The spinner keeps the existing button box and size. No label is shown inside the box while loading, and the label remains available to screen readers.
- **AC-3**: When Clerk reports a session, each auth control returns to the label that matches the session, such as Get started, Go to dashboard, Sign in, Dashboard or UserButton, and becomes clickable.
- **AC-4**: While Clerk resolves on a protected dashboard route, the dashboard shell stays mounted and the content area shows a spinner. The user never sees a blank main area, and a signed out user is redirected once Clerk is loaded.
- **AC-5**: Every data view has four explicit states: loading, error, empty and ready. Success for a data view is the ready state, with no success banner.
- **AC-6**: The first load of a data view shows a tailored skeleton with a polite screen reader status. The ticket list uses rows, forms uses cards, and form and detail pages use field shapes.
- **AC-7**: A refresh or a filter change keeps existing content visible and shows a small busy indicator. It never replaces the content with a full skeleton.
- **AC-8**: A failed load shows a friendly message where the content would be, with a manual retry button when the action is repeatable. A failed action shows a toast or an inline alert next to the form. Raw errors and stack text go to the console only.
- **AC-9**: No request retries automatically. Retry happens only when the user chooses it.
- **AC-10**: Error text comes from one small map that covers network failures, access failures, missing resources and a generic fallback. Actions may supply a code and a customer facing detail such as a ticket number, which the map may use. Unknown messages get the fallback.
- **AC-11**: An empty result from filters says no tickets match these filters and offers Clear all filters. An empty data set says no tickets yet and offers New ticket. Forms and other data views follow the same split.
- **AC-12**: The all tickets, notifications and settings placeholder routes stay informational empty states. They do not gain loading or error behaviour because they fetch nothing.
- **AC-13**: A dedicated success screen is used only where the user needs a result to keep, currently the public form with its ticket number and confirmation status. Other mutations use react hot toast with short, aligned copy, such as Ticket created or Form disabled.
- **AC-14**: Loading states announce with a polite status, errors announce with an alert, and keyboard focus stays stable when content swaps.
- **AC-15**: Shared code is limited to updating `Button`, `Spinner` and `EmptyState`, adding one `ViewState` helper and adding one error message helper. No new data fetching library, state management library or toast wrapper is added.
- **AC-16**: Tests cover the shared state helper, the landing page Clerk gate, and one representative data page across loading, error, empty and ready states.
- **AC-17**: No new endpoint, environment variable, secret or schema change is introduced by this standard.
- **AC-18**: If Clerk never settles, the landing page stays in its spinner state. There is no timeout that could fire on a slow connection.

## Options considered

### Option 1: One migration pull with a shared helper and tests

Write the standard, add the small shared pieces, and move every in scope screen to them in one coordinated pull request. Tests on the helper, the auth gate and a representative data page run in the CI job that already exists. A pull request checklist reminds reviewers to cover all four states on new screens.

**Pros**:
- Ends the inconsistency in one step, so there is no long period with two ways to do the same thing.
- The helper gives one place to fix spacing, announcements and error behaviour later.
- Tests give automatic feedback on the load bearing paths.

**Cons**:
- Larger diff and more review time than a narrow fix.
- Several screens change at once, so a visual regression can slip through without a careful review.

### Option 2: Enforce going forward only

Write the standard and leave existing screens as they are. New code must follow it, and old violations become tracked debt.

**Pros**:
- Small first change and fast review.
- Low risk to screens that already work.

**Cons**:
- The app keeps its mixed states for an unknown time.
- The first slice the engineer asked for would not actually fix the rest of the app.

### Option 3: Document only

Write the standard and rely on code review, with no helper and no new tests.

**Pros**:
- No code churn and no new abstraction.
- Fastest path to a written rule.

**Cons**:
- Nothing stops the next screen from inventing its own states.
- Reviewers must remember every rule each time, which is how the drift started.

## Decision

**Chosen option**: Option 1: One migration pull with a shared helper and tests.

Use one `ViewState` helper for the four data view states, update the existing UI primitives, and migrate the screens in small reviewable commits inside the same pull request. Enforcement is a pull request checklist plus CI tests, because a lint rule for JSX state markup would be brittle and there is no type layer to lean on.

## Rationale

The current code already contains good patterns, so replacing them would be wasteful. `Button` already has a loading prop, `Spinner` and `EmptyState` already exist, and the ticket list already has the right skeleton and empty split. Extending those pieces keeps the change small and familiar.

The engineer chose whole app coverage with the home page first, so a going forward rule would leave the stated problem unsolved. One pull request gives a single point where the old patterns are retired. Tests on the helper and the two key surfaces are the strongest automatic check this plain JavaScript app can support without adding a new tool. The toast and result screen rules keep feedback predictable without a new wrapper library.

## Standard definition

**Canonical pattern**:

```jsx
const StatefulView = () => {
  const { state, data, error, refreshing, retry, clearFilters, openCreate, hasFilters } = useSomeData()

  return (
    <ViewState
      state={state}
      refreshing={refreshing}
      skeleton={<SomeViewSkeleton />}
      error={error}
      onRetry={retry}
      empty={{
        title: hasFilters ? 'No matches' : 'Nothing here yet',
        description: hasFilters
          ? 'Try a different search or clear a filter.'
          : 'Create one to get started.',
        action: hasFilters
          ? <Button onClick={clearFilters}>Clear filters</Button>
          : <Button onClick={openCreate}>New item</Button>,
      }}
    >
      <SomeContent data={data} />
    </ViewState>
  )
}
```

`state` is one of `loading`, `error`, `empty` or `ready`. `ViewState` renders the skeleton on first load, the error block with retry, the empty block with its action, or the children. `refreshing` shows a small inline busy indicator and leaves the children mounted. Auth controls use `Button loading={!isLoaded}`, where `Button` hides its children visually with a screen reader only span and renders a small `Spinner` inside the same box.

Error text comes from `friendlyError(error, fallbackText)` in `client/src/lib/error-message.js`. The helper checks a code supplied by an action first, then known message patterns, then the fallback. Actions in scope gain a code for known server responses during the migration, and set it only when the server message is safe to show. Unchanged actions fall back to message patterns. Raw errors stay in the console. UserButton is not a `Button`, so its loading form is a fixed size span with a small `Spinner` in the same footprint.

State transitions:

```text
initial, loading, ready
initial, loading, error, manual retry, loading
initial, loading, empty, create action, loading
ready, refreshing, ready
ready, refreshing, error, manual retry, loading
auth loading, auth ready
```

No automatic retry exists in any transition. Filter changes move from ready to refreshing, not to loading. If Clerk never settles, the auth loading state stays until it does.

**API surface** (client only, no HTTP changes):

| Surface | Inputs | Outputs | Notes |
|---|---|---|---|
| `Button` | `loading`, existing variant and size props | Same button box with a small spinner and a screen reader label when loading | Used for auth controls and all submitting actions |
| `Spinner` | `className` | Animated ring with `role=status` and an accessible label | Default size for pages, small size inside buttons |
| `EmptyState` | `icon`, `title`, `description`, `action` | Centred empty view | Reused by `ViewState` |
| `ViewState` | `state`, `refreshing`, `skeleton`, `error`, `onRetry`, `empty`, `children` | One of the four state views | New helper in `client/src/components/ui` |
| `friendlyError` | `error`, `fallbackText` | Display text | New helper in `client/src/lib` |
| `DashboardShell` | Clerk `isLoaded` and `isSignedIn` | Shell with spinner, or shell with routes, or redirect | Gating moves into the shell so the layout stays mounted |

**Value sourcing**:

| Value | Source |
|---|---|
| Auth control spinner | `isLoaded` from `useAuth` in `landing.jsx`, passed to `navbar`, `hero` and `final-cta` |
| Auth control label | `isSignedIn` from `useAuth`, with labels defined in the landing components |
| Data view state | Local page state set by the existing action promise result |
| Refresh indicator | Local page state set when a refetch or filter change starts |
| Skeleton shape | A tailored skeleton component per view, defined beside that view |
| Error text | `friendlyError` map, with optional `code` and customer facing detail from the action |
| Empty copy and action | `empty` prop from the page, chosen from data count and active filters |
| Success screen values | `ticketNumber` and `confirmationSent` from the public form submit response |
| Toast copy | Short local constants in each page, following the copy rule in AC-13 |

**Key invariants**:
- Only one state is rendered at a time for a given view.
- A failed action never clears previously loaded data.
- Raw error text never renders in the UI.
- Retry is always an explicit user action.
- Auth controls never fire on click before Clerk reports a session.
- The public form success screen is a result view, not the ready state of a data view.

**Security model**:
Existing Clerk auth and org scoping stay unchanged. Errors shown to users never include stack traces, tokens or internal paths. No new sensitive data is stored or logged. No compliance scope is triggered by this change.

**Critical test scenarios**:
- Happy path: with Clerk loaded and signed out, the landing page shows Get started and Sign in, and clicking opens Clerk, verifies **AC-3**
- Loading: with Clerk not loaded, the landing page shows small spinners with no visible labels and GitHub links remain active, verifies **AC-1**, **AC-2**, **AC-18**
- Loading: with a data promise pending, the view shows its tailored skeleton and a polite status, verifies **AC-6**
- Failure: a fetch rejects with a network error, the view shows mapped text and a retry button, and retry starts one new request, verifies **AC-8**, **AC-9**, **AC-10**
- Empty: a filter hides every row, the view shows the filter message and Clear all filters, verifies **AC-11**
- Refresh: a filter change while data is present keeps rows on screen and shows a busy indicator, verifies **AC-7**
- Auth: a signed out user hitting a dashboard route sees the shell with a spinner while Clerk resolves, then is redirected, verifies **AC-4**

**Replaces**:
- `Button` showing a spinner next to a label while auth loads
- Plain text loaders such as "Loading..." and labels such as "Creating..." as the only loading feedback
- Full page spinners and blank route gates where a skeleton or shell spinner belongs
- Raw server messages shown directly to users
- One empty message reused for no data and no filter match

**Enforcement**:
Add `.github/PULL_REQUEST_TEMPLATE.md` with a short checklist asking whether new or changed data views cover loading, error, empty and ready, and whether errors use `friendlyError`. CI already runs `npm test --prefix client` and the client build, so the tests in the rollout fail a pull request that breaks those paths. A lint rule is deliberately not used because this plain JavaScript app has no type layer and JSX state markup would make the rule brittle.

**Rollout**:

1. Pull or rebase onto `origin/main`, then add `client/src/lib/error-message.js` with the friendly map and unit tests for network, access, missing, supplied code and unknown errors, satisfies **AC-8**, **AC-10**, **AC-17**.
2. Update `Button` so `loading` hides children visually with a screen reader only span and renders a small `Spinner` inside the unchanged box. Test that the accessible name remains and that clicks are disabled, satisfies **AC-1**, **AC-2**, **AC-14**.
3. Add `client/src/components/ui/view-state.jsx` with the four states, the inline busy indicator, polite loading status and alert error role. Export it from `components/ui/index.js` and test it directly, satisfies **AC-5**, **AC-7**, **AC-8**, **AC-11**, **AC-14**.
4. Add tailored skeleton components for the ticket list, forms cards, public form fields and ticket detail fields. Reuse the table shell in `ticket-list.jsx` so the header does not jump, satisfies **AC-6**.
5. Update `landing.jsx`, `navbar.jsx`, `hero.jsx` and `final-cta.jsx` so all auth controls use `Button loading={!isLoaded}` and UserButton gets the same footprint spinner. Leave GitHub links active. Test with mocked Clerk hooks for loading, signed out and signed in, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-18**.
6. Move the protected route gate into `DashboardShell`, rendering the shell with a spinner in the content area while Clerk resolves and redirecting signed out users once loaded. Keep nested routes unchanged, satisfies **AC-4**.
7. Migrate the tickets page to `ViewState` and `friendlyError`. Keep the existing filter empty states, skeleton table and manual retry. Add a small toolbar busy indicator for refresh and filter changes, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-9**, **AC-11**, **AC-14**.
8. Migrate the forms page to `ViewState`. Keep organization and admin gating as distinct empty states. Use `Button loading` for create and row actions, and use aligned toast copy, satisfies **AC-5**, **AC-8**, **AC-11**, **AC-13**, **AC-15**.
9. Migrate the public form to the shared spinner and error map. Keep the dedicated success screen with the ticket number and confirmation status, and keep the submit button in loading state while posting, satisfies **AC-5**, **AC-8**, **AC-10**, **AC-13**.
10. Migrate create ticket and edit ticket to skeletons, inline errors with retry and `Button loading` for submit. Give edit ticket a not found empty state, satisfies **AC-5**, **AC-6**, **AC-8**, **AC-10**, **AC-13**.
11. Apply `Button loading` to the create ticket modal and comment submit. Leave the all tickets, notifications and settings placeholder pages as they are, satisfies **AC-12**, **AC-15**.
12. Add the pull request checklist, run the full client test suite and client build, and confirm every acceptance criterion has a test or a reviewed screen check, satisfies **AC-16**, **AC-17**.

**Exceptions**:
Static placeholder routes, third party widgets such as UserButton and Altcha, external links, and modal or drawer submit buttons do not use `ViewState`. They use `Button loading` where they can be busy. The public form success screen is a result view and stays outside the four data view states.

## Consequences

**Positive**:
- One predictable set of states across the app, with stable layouts and clear next actions.
- Users see friendly errors and keep their data when a refresh fails.
- New screens have a concrete pattern to copy, and CI checks the load bearing parts.

**Negative / tradeoffs**:
- One coordinated change touches many screens, so review needs care and visual checking.
- A shallow helper adds one more file for a small app to maintain.
- Keeping labels only for screen readers means the visual label disappears during loading, which is intentional but different from today.
- The error map needs a new entry when a new action adds a distinct customer facing failure.

**Neutral**:
- Test names and fixtures change where pages move to `ViewState`.
- The pull request checklist is a reminder, not an automatic gate.
- Existing toast library and auth provider stay in place.

## Follow-up

- [ ] Pull or rebase this checkout onto `origin/main` before implementation, since it is 11 commits behind
- [ ] Add a root `AGENTS.md` that records the stack and this state convention so later work does not rediscover it
- [ ] Add `.github/PULL_REQUEST_TEMPLATE.md` with the state coverage checklist in the rollout
- [ ] Decide later whether repeated toast wording justifies a shared toast helper
- [ ] Consider a React error boundary for render failures, which is outside this standard
