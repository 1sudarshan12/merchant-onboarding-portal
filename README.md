# Merchant Portal

An Angular merchant onboarding application being built in guided checkpoints. The current UI includes a responsive shell, lazy workspace overview, shared Material/SCSS theme, and preparation checklist. Checkpoint 3 adds shared application types and a tested mock API for authentication, role permissions, drafts, and reviews. The frontend login and business pages will connect to this API in later checkpoints.

## Run locally

The development environment used for this checkpoint is Node.js 24.14.0 and npm 11.9.0. Angular 21 supports Node `^20.19.0`, `^22.12.0`, or `^24.0.0`; see the [official compatibility table](https://angular.dev/reference/versions).

```bash
npm ci
npm run dev
```

Open <http://localhost:4200>; the router redirects to `/overview`. The command runs Angular on port 4200 and the mock API on `127.0.0.1:3000`. Stop any earlier `npm start` process first to free port 4200. Angular proxies `/api/**` to the API; restart Angular after a proxy change. `npm run dev` stops both child processes if either exits.

No environment variables are required. The optional `.env.example` documents latency, token expiry, and one-time error settings; copy it to `.env` to change them. All data is fictional and resets when the API restarts. The frontend does not yet show a login form.

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
- `src/app/app.config.ts` registers application providers, including the router.
- `src/app/app.routes.ts` registers the lazy `/overview` route and the root redirect.
- `src/app/app.ts`, `app.html`, and `app.scss` define the responsive shell and navigation.
- `src/app/features/workspace/` contains the overview page and preparation checklist dialog.
- `src/styles/_tokens.scss` defines shared colors, spacing, radii, and typography.
- `public/application-illustration.svg` is a decorative local illustration; it represents no merchant record.
- `src/styles.scss` defines the Material theme and global styles. Fonts are local system fonts, so building does not need a font download.
- `src/app/app.spec.ts` checks real route rendering and the checklist open/close interaction with TestBed.
- `shared/models.ts` defines API request/response types; `shared/permissions.ts` defines reusable role and record permission predicates.
- `mock-api/server.ts` starts the server; `app.ts` defines HTTP behavior; `auth.ts` manages expiring sessions.
- `mock-api/validation.ts` validates incoming data at runtime; `responses.ts` constructs safe public responses; `seed.ts` supplies fictional records.
- `mock-api/app.spec.ts` exercises the API over HTTP; `shared/permissions.spec.ts` checks permission rules.

The current tests cover the shell/dialog plus server-side authentication, permissions, pagination, masking, validation, version conflicts, workflow transitions, and retryable failures. Frontend concurrent refresh, form interactions, and autosave still need implementation and tests.

## Documentation maintained with each checkpoint

- [Design guide](docs/DESIGN.md): visual rules, design tokens, responsive behavior, and accessibility.
- [Architecture](docs/ARCHITECTURE.md): decisions, assumptions, and responsibilities.
- [API contract](docs/API.md): setup, demo accounts, requests, responses, validation, and errors.
- [Security notes](docs/SECURITY.md): implemented controls, mock limitations, and remaining frontend/deployment work.
- [Learning log](docs/LEARNING_LOG.md): explanations and small exercises.
- [Progress](docs/PROGRESS.md): implemented work, verification results, and next steps.
- [AI assistance](docs/AI_USAGE.md): assistance received and the verification actually performed.

Each implementation checkpoint updates the relevant notes and records the checks run. Planned features are kept distinct from implemented behavior.

This is a private take-home project. Submission preparation and reviewer access remain future work.
