# client

## Overview

The React front end. A Create React App 5 app on React 18, with Clerk handling sign in and the server handling everything else. Pages read from hooks, hooks read from actions, and actions are the only place that calls `fetch`. There is no test file in this package yet.

## Key files

| File | Owns |
|---|---|
| `src/index.js` | Mounts `ClerkProvider`, `App`, and the toast container |
| `src/App.js` | The only route table. `/` is public, `/dashboard/*` sits inside `<Show when="signed-in">` |
| `src/lib/constants.js` | `API_BASE_URL` and the option lists for status, priority, and type |
| `src/lib/utils.js` | `cn()`, the clsx plus tailwind merge helper every component uses |
| `src/components/ui/index.js` | The barrel for the hand rolled component kit |
| `src/components/dashboard/dashboard-shell.jsx` | The nested layout, with the `Outlet` |
| `src/components/dashboard/dashboard-sidebar.jsx` | `NAV_ITEMS`. Adding a page means adding an entry here |
| `src/hooks/use-tickets.js` | The one ticket data hook. Holds the priority grouped response as it comes back, with a request key guard against out of order responses |
| `src/hooks/use-knowledge-articles.js` | The knowledge base hook. Lists org articles and owns the upload state, same request key guard |
| `src/pages/settings.jsx` | Organization settings. Admin only, and its Knowledge base tab is the only section so far |
| `src/actions/*.js` | One file per API call. The only files that call `fetch` |
| `src/components/landing/*` | The public marketing page, all of it static |

## Commands

```bash
npm start     # react-scripts start, port 3000
npm run build
npm test       # Jest, in watch mode, and there is nothing to run
```

## Conventions

- Components are `.jsx`, plain modules are `.js`, and data and action files are `kebab-case`. Match the file you are editing.
- `components/ui/` is a hand rolled kit in the shadcn spirit. Each file default exports a function component that takes `className` and merges it with `cn()`. Most export a plain `variants` object, not a `cva` call, even though `class-variance-authority` is installed.
- Feature code imports from the barrel: `import { Button, Card } from "../ui"`. `Drawer` and the resizable primitives are the exceptions, they are imported by direct path and are not in the barrel.
- Only two files use `@base-ui/react`, the drawer and the menu select. The rest of the kit is plain markup plus Tailwind.
- `Input`, `Textarea`, and `Select` all take `label` and `error` and render the error text themselves, so a form does not have to.
- Icons are Lucide through `react-icons/lu`, sized with `className="h-4 w-4"`. Never raw SVG.
- Styling is Tailwind 3 with HSL tokens defined in `src/index.css` and mapped in `tailwind.config.js`. That is where the non stock utilities come from: `text-info`, `bg-success`, `text-muted-foreground`, `bg-popover`, `text-accent-foreground`, `border-sidebar-border`. Look there before inventing a colour.
- Data flows page to hook to action to `fetch`. Pages never call `fetch`, hooks never build a URL.
- Every action sends `Authorization: Bearer ${token}` from Clerk's `getToken()`. An `actions/` module exports plain async functions and throws on a bad response.
- The server returns `GET /api/tickets` grouped by priority, and `use-tickets.js` stores that object as is. The pages flatten it themselves with `Object.values(tickets)`, see `pages/dashboard.jsx` and `pages/tickets.jsx`. Anything new that lists tickets needs the same step.
- UI enums are `kebab-case` strings, API enums are `SCREAMING_SNAKE_CASE`. `toApiEnumValue` in the ticket actions and `normalizeValue` in `ticket-details/utils.js` are the two bridges. Reuse them.

## Gotchas

- **`REACT_APP_API_BASE_URL` falls back to a live production host.** `src/lib/constants.js` defaults it to a Railway URL, so forgetting the variable sends a development Clerk token to a real deployment. Set it in `client/.env.local`; the root README does not mention it.
- **Client actions throw away the server's error message.** They do `if (!response.ok) throw new Error("Failed to ...")` and never read the body, so `ApiError` details and zod issues never reach the user. Generic toasts are the reason. `actions/upload-knowledge-document.js` is the exception, it reads `body.error` because every upload rejection (413, 415, 422) is user actionable. Follow it for anything with a message worth showing.
- **axios is installed and never used.** Do not reach for it in a new action.
- **The client is ESM `import` only,** while the server is CommonJS. The root rule against mixing them is the thing to watch here.
- **A `.dark` block and a Tailwind `darkMode: ["class"]` setting exist, but no toggle is wired.** Do not assume dark mode is reachable.
- **`client/.env.local` also holds `CLERK_SECRET_KEY`.** CRA only inlines `REACT_APP_` names so it does not reach the bundle, but it is a server secret living in the client workspace and compose loads that file as an `env_file`.
- **`REACT_APP_CLERK_AFTER_SIGN_OUT_URL` is set but unread.** `src/index.js` hardcodes `/dashboard` as the sign in and fallback redirect.
- **`client/audit.json` is a committed `npm audit` dump,** so an audit run will dirty the tree. `client/build/` exists on disk but is gitignored, so leave it alone and do not commit it.
- `class-variance-authority`, `bootstrap`, `react-bootstrap`, and `uuid` are also installed and unused.
- **The multipart upload action must not set `Content-Type`.** `POST /api/kb/upload` is the only non JSON body here, and the server runs multer with `fields: 0`, so the form data may carry the `file` entry and nothing else. The browser has to set the boundary itself.
- **There is no test file anywhere in `client/src`.** The knowledge base has a page, actions, a hook, and a drop zone, and still no test.

## Agent skills

- [clerk-react-patterns](.agents/skills/clerk-react-patterns/): `clerk/clerk`, provider setup, `useAuth` and `useUser`, protected routes, sign in and sign up forms
- [clerk-custom-ui](.agents/skills/clerk-custom-ui/): `clerk/clerk`, custom flows and component appearance
- [clerk-orgs](.agents/skills/clerk-orgs/): `clerk/clerk`, organizations, roles, and permissions, which map onto the server's `ADMIN_ROLES`
- [clerk-backend-api](.agents/skills/clerk-backend-api/): `clerk/clerk`, the Backend REST API, for user and organization lookups
- [clerk-webhooks](.agents/skills/clerk-webhooks/): `clerk/clerk`, webhook events and verification
- [frontend-design](.agents/skills/frontend-design/): `anthropics/skills`, interface design guidance for building and polishing pages

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
