# Merchant Portal

An Angular merchant onboarding application being built in guided checkpoints. The foundation currently renders a responsive starting page using Angular Material. Authentication, the mock API, and application workflows are not implemented yet.

## Run locally

The development environment used for this checkpoint is Node.js 24.14.0 and npm 11.9.0. Angular 21 supports Node `^20.19.0`, `^22.12.0`, or `^24.0.0`; see the [official compatibility table](https://angular.dev/reference/versions).

```bash
npm ci
npm start
```

Open <http://localhost:4200>. The current frontend needs no environment variables or running backend. The pre-existing `.env.example` is unrelated to this foundation and is not loaded; it will be replaced when the mock API configuration is implemented.

## Commands

| Command                | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `npm start`            | Run the Angular development server.                          |
| `npm run build`        | Create a production build in `dist/merchant-portal/browser`. |
| `npm test`             | Run component tests in watch mode.                           |
| `npm run test:ci`      | Run Vitest tests once through Angular's test builder.        |
| `npm run format:check` | Check source and documentation formatting.                   |
| `npm run format`       | Format source and documentation.                             |

## Read the code

- `src/main.ts` starts the standalone Angular application.
- `src/app/app.config.ts` registers application providers, including the router.
- `src/app/app.routes.ts` will define the feature routes; it is currently empty.
- `src/app/app.ts`, `app.html`, and `app.scss` define the starting page.
- `src/styles.scss` defines the Material theme and global styles. Fonts are local system fonts, so building does not need a font download.
- `src/app/app.spec.ts` is the first TestBed rendering smoke test.

The initial test verifies component and template wiring. It does not yet exercise business behavior. Tests for permissions, concurrent token refresh, form validation, and draft saving will accompany those implementations.

## Documentation maintained with each checkpoint

- [Architecture](docs/ARCHITECTURE.md): decisions, assumptions, and responsibilities.
- [Learning log](docs/LEARNING_LOG.md): explanations and small exercises.
- [Progress](docs/PROGRESS.md): implemented work, verification results, and next steps.
- [AI assistance](docs/AI_USAGE.md): assistance received and the verification actually performed.

Each implementation checkpoint must update the relevant notes and record the checks run. Planned features are kept distinct from implemented behavior. Security documentation will grow alongside authentication and sensitive-data handling.

This is a private take-home project. Submission preparation and reviewer access remain future work.
