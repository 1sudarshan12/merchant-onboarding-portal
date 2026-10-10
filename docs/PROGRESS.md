# Progress

Last updated: 10 October 2026.

## Completed

- Reviewed the original assignment and both proposed plans.
- Distinguished required functionality from optional additions and recorded conflicting plan assumptions.
- Identified correctness risks to resolve before autosave, masking, and authentication implementation.
- Created architecture, learning, progress, and AI-assistance records.

## Checkpoint 1: Angular foundation implemented

The selected foundation is Angular 21, standalone components, strict TypeScript, Angular Material with SCSS, and Vitest with Angular TestBed. The original assignment permits Angular 20+.

| Work item                                   | Status                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Generate and configure Angular project      | Complete: standalone, strict TypeScript, OnPush, router.                                                                     |
| Establish starting page and Material styles | Complete: responsive starting page and local SCSS theme.                                                                     |
| Verify build                                | Passed: `npm run build`, no warnings, 231.84 kB initial bundle.                                                              |
| Verify initial component test               | Passed: `npm run test:ci`, one TestBed test.                                                                                 |
| Inspect running page                        | Passed: desktop and 375px width, no horizontal overflow; skip link moves focus to main; no captured browser warnings/errors. |
| Complete learner exercise                   | Not yet recorded.                                                                                                            |

The implementation portion of checkpoint 1 is complete. Checkpoint 2 below builds on it; the learner exercise remains unrecorded. No business feature, permission enforcement, autosave, or token-refresh behavior is claimed complete at this checkpoint.

## Checkpoint 2: Visual foundation and workspace shell

Implemented a consistent Material/SCSS theme with semantic tokens, responsive sidebar/drawer, lazy `/overview` route, a preparation checklist dialog, accessible decorative icons, and a local SVG illustration. Added a design guide and updated the setup, architecture, learning, and AI-assistance records.

Verification:

- Production build: `npm run build` passed without warnings; 435.48 kB initial bundle and a separate 7.76 kB workspace chunk.
- TestBed: `npm run test:ci` passed both route/dialog integration tests.
- Browser: desktop and 375px layouts inspected; no horizontal overflow detected.
- Keyboard: skip link stays on `/overview` and focuses main; dialog Tab focus wraps; Escape returns focus to its opener. The nested mobile drawer/checklist flow restores focus to the drawer button, then the menu button.
- Console: no warnings or errors captured during the final browser checks.
- Review: corrected insufficient contrast on the small stage numbers.
- Formatting: `npm run format:check` passed.

This is the visual foundation. It does not yet implement the application dashboard, server pagination, login, permission enforcement, draft saving, or reviews. Next work is the domain/API contract and mock server.

## Checkpoint 3: Domain contracts and mock API

Implemented shared application/user/request/response models, role and record permission helpers, and an Express mock API. Five demo users and 30 synthetic applications exercise all workflow statuses. The API supports login, expiring access tokens, rotating refresh tokens, logout, scoped pagination/filtering, versioned draft saves, submission validation, admin assignments, reviewer decisions, masked responses, and permission-checked reveal.

Added `npm run dev`, separate Node tests/type checking, Angular's `/api/**` proxy, and optional environment controls for latency, expiry, and one-time list/save failures. Replaced the unrelated environment template. Updated setup/architecture/learning notes and added API and security documentation.

Verification:

- API and shared permissions: `npm run test:api` passed 25 tests (20 HTTP scenarios and five permission tests).
- Strict API/shared/test types: `npm run typecheck:api` passed.
- Angular TestBed: `npm run test:ci` passed both existing route/dialog tests.
- Production build: `npm run build` passed without warnings; initial browser bundle remains 435.48 kB, workspace chunk 7.76 kB.
- Live HTTP through Angular on temporary port 4201: health, login, scoped page of five out of 15 SALES records, logout, and revoked-token rejection all passed. Temporary verification servers were stopped afterwards.
- The default `npm run dev` launched the API but detected the existing Angular server occupying 4200 and stopped its child processes as configured. The separate-server check used 4201 to preserve that existing process. Stop an earlier Angular server before starting `npm run dev`.
- Formatting: `npm run format:check` passed.

The initial API test attempt hit sandbox restrictions on local listening; the same tests passed with local networking permitted. A startup check also exposed a misleading success message when Express's listen callback received an error; startup now uses Node's HTTP server so success is logged only after listening.

This completes the backend implementation portion of Checkpoint 3. Frontend login, refresh coordination, guards, dashboard, autosave, and review pages are still future work. Candidate review and learner exercises remain unrecorded.

## Future checkpoints

4. Implement frontend authentication, concurrent-401 refresh, and access control with focused tests.
5. Build the responsive dashboard with server-side pagination, filtering, and error/retry behavior.
6. Build the application wizard, validation, masked draft restoration, and reliable autosave.
7. Add application detail, assigned reviews, admin assignments, and controlled sensitive-field reveal.
8. Complete accessibility and responsive checks, security documentation, meaningful regression tests, and submission preparation.

Update documentation and record verification during each checkpoint. Counts and real-time updates remain optional; prioritize completing the required workflows.

## Schedule and submission

The assignment expects six to eight hours of work and a return within three to five calendar days, with holiday flexibility. The plans mention 12 October 2026; that exact date remains unconfirmed from the supplied assignment. Track actual effort and confirm the deadline from the candidate's correspondence.

A private repository and reviewer access are submission work still to be completed. No repository publication, invitation, or external communication is recorded here.
