# Merchant Portal

An Angular merchant onboarding application being built in guided checkpoints. The current UI includes sign-in, a protected responsive workspace, and an application dashboard with server pagination, merchant search, status filters, and loading, empty, error, and retry states. SALES users can create and edit their own drafts in a five-step wizard, with validation, autosave, masked restoration, and submission. The mock API enforces roles and supports the remaining review workflow; application detail, reviewer assignment, and approval/rejection screens remain future checkpoints.

## Run locally

The development environment used for this checkpoint is Node.js 24.14.0 and npm 11.9.0. Angular 21 supports Node `^20.19.0`, `^22.12.0`, or `^24.0.0`; see the [official compatibility table](https://angular.dev/reference/versions).

```bash
npm ci
npm run dev
```

Open <http://localhost:4200>. An anonymous visitor reaches `/login`; choose a demo account and sign in. The default destination is `/overview`; choose **Applications** in the sidebar to open `/applications`. A direct visit to `/applications` returns there after login. The command runs Angular on port 4200 and the mock API on `127.0.0.1:3000`. Stop any earlier `npm start` process first to free port 4200. Angular proxies `/api/**` to the API; restart Angular after a proxy change. `npm run dev` stops both child processes if either exits.

No environment variables are required. The optional `.env.example` documents latency, token expiry, and one-time error settings; copy it to `.env` to change them. All data is fictional and resets when the API restarts. Frontend sessions are held only in memory, so reloading the browser requires another login. API records remain until the API restarts.

To try the wizard, sign in as Sales and choose **New application**, then **Create draft**. Existing own drafts show **Edit draft** in Applications. The five steps are Business, Contact, Banking, Processing, and Review. Confirmed saves remain on the mock server until it restarts; unconfirmed local edits are not persisted in the browser. See [the wizard guide](docs/WIZARD.md) for saving and conflict behavior.

Demo accounts: `sales1@example.test`, `sales2@example.test`, `reviewer1@example.test`, `reviewer2@example.test`, and `admin@example.test`. All use the public demo password `Demo#1234`. See the [API contract](docs/API.md) for login requests, endpoint details, permissions, and sample records.

## Commands

| Command                 | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `npm start`             | Run the Angular development server.                              |
| `npm run dev`           | Run Angular and the mock API together.                           |
| `npm run start:api`     | Run only the mock API.                                           |
| `npm run build`         | Create a production build in `dist/merchant-portal/browser`.     |
| `npm test`              | Run component tests in watch mode.                               |
| `npm run test:ci`       | Run Vitest tests once through Angular's test builder.            |
| `npm run test:api`      | Run API integration and shared permission tests in Node.         |
| `npm run typecheck:api` | Strictly type-check mock API, shared contracts, and their tests. |
| `npm run format:check`  | Check source and documentation formatting.                       |
| `npm run format`        | Format source and documentation.                                 |

## Read the code

- `src/main.ts` starts the standalone Angular application.
- `src/app/app.config.ts` registers the router and `HttpClient` with the authentication interceptor.
- `src/app/app.routes.ts` defines public login and guarded lazy workspace routes.
- `src/app/app.ts`, `app.html`, and `app.scss` provide the root router outlet.
- `src/app/layout/workspace-shell.*` defines authenticated navigation, the current identity, dynamic breadcrumbs, and sign out.
- `src/app/core/auth/` contains session state, the bearer/refresh interceptor, guards, and safe return navigation.
- `src/app/features/auth/` contains the typed login form.
- `src/app/features/applications/` contains the dashboard, its page-scoped store, and list API service.
- `src/app/features/application-wizard/` contains the typed merchant form, five-step flow, serialized autosave, draft API, and leave-confirmation dialog.
- `src/app/features/workspace/` contains the overview page and preparation checklist dialog.
- `src/styles/_tokens.scss` defines shared colors, spacing, radii, and typography.
- `public/application-illustration.svg` is a decorative local illustration; it represents no merchant record.
- `src/styles.scss` defines the Material theme and global styles. Fonts are local system fonts, so building does not need a font download.
- `src/app/app.spec.ts` uses the actual application providers, real authentication service, and an HTTP test backend to check login, guarded navigation, bearer headers, dashboard rendering, the checklist, and logout.
- `shared/models.ts` defines API request/response types; `shared/permissions.ts` defines reusable role and record permission predicates.
- `mock-api/server.ts` starts the server; `app.ts` defines HTTP behavior; `auth.ts` manages expiring sessions.
- `mock-api/validation.ts` validates incoming data at runtime; `responses.ts` constructs safe public responses; `seed.ts` supplies fictional records.
- `mock-api/app.spec.ts` exercises the API over HTTP; `shared/permissions.spec.ts` checks permission rules.

Tests are written for frontend authentication and concurrent refresh, real application wiring, dashboard request cancellation and retry, and server-side permissions, pagination, masking, validation, version conflicts, and workflow transitions. See the progress log for executed checks and results. Wizard tests cover masked restoration, validators, serialized autosave, final-save-before-submit, conflicts, and navigation safeguards. Detail/review interactions remain to be implemented.

## Documentation maintained with each checkpoint

- [Design guide](docs/DESIGN.md): visual rules, design tokens, responsive behavior, and accessibility.
- [Architecture](docs/ARCHITECTURE.md): decisions, assumptions, and responsibilities.
- [Authentication](docs/AUTHENTICATION.md): session state, guarded navigation, shared refresh, and logout races.
- [Dashboard](docs/DASHBOARD.md): server-driven queries, request cancellation, result states, and permitted draft actions.
- [Wizard](docs/WIZARD.md): typed forms, draft restoration, autosave, conflicts, submission, and leaving safely.
- [API contract](docs/API.md): setup, demo accounts, requests, responses, validation, and errors.
- [Security notes](docs/SECURITY.md): implemented controls, mock limitations, and remaining frontend/deployment work.
- [Learning log](docs/LEARNING_LOG.md): explanations and small exercises.
- [Progress](docs/PROGRESS.md): implemented work, verification results, and next steps.
- [AI assistance](docs/AI_USAGE.md): assistance received and the verification actually performed.

Each implementation checkpoint updates the relevant notes and records the checks run. Planned features are kept distinct from implemented behavior.

This is a private take-home project. Submission preparation and reviewer access remain future work.
