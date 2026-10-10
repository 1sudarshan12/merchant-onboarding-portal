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

## Checkpoint 4: Frontend authentication

Implemented typed login with demo-role selection, in-memory session signals, authenticated navigation and logout, route guards, a trusted-API bearer interceptor, coordinated refresh, and bounded retries. Session revisions protect against late responses after logout or a new login. See [Authentication](AUTHENTICATION.md).

The checkout at the start of Checkpoint 5 contained these auth files but still used the earlier root shell/configuration. Checkpoint 5 reconnects the actual providers and protected routes. Integration tests now use `appConfig` directly and verify login → bearer-authenticated dashboard → logout, so isolated feature tests cannot conceal missing application wiring.

Checkpoint 5 verification included all auth HTTP/guard/login tests in the 47-test Angular suite recorded below. Memory-only sessions intentionally require sign-in after a browser reload. No persistent-session behavior is claimed.

## Checkpoint 5: Application dashboard

Implemented the lazy protected `/applications` route, authenticated navigation, a typed HTTP service, component-scoped signal/RxJS store, server pagination, 300 ms merchant-name search, status filtering, and loading/empty/error/retry states. Search/status/page-size changes reset pagination. The server remains responsible for role scope and totals. Desktop uses a semantic table; phones use labelled cards.

Added [dashboard implementation notes](DASHBOARD.md), learning exercises, and updates to setup, architecture, API, authentication, design, security, and AI-assistance records. Creation, editing, detail, and review controls remain future work.

Verification on 10 October 2026:

- `npm run test:ci`: 47 tests passed across six files, including eight store scenarios, nine dashboard component scenarios, and five tests using the real root configuration.
- `npm run build`: passed without warnings; initial bundle 301.75 kB, lazy applications chunk 89.36 kB. Existing bundle/style budgets are unchanged.
- Live Sales flow: direct `/applications` redirects through login and returns to the dashboard; 15 records appear as ten plus five; Draft resets to page one with three matching records; page size 25 returns all 15; unmatched search shows its recovery state.
- Live role checks: Reviewer saw nine records, each assigned to that reviewer; Admin saw a 30-record total with both Sales creators. Mobile navigation opened the Applications route successfully.
- Mobile at 375px: cards and paginator fit without horizontal overflow. Keyboard Next retains focus even at the last page; page-size selection retains its combobox focus; clearing an empty result returns focus to search.
- Failure/refresh check: a temporary mock process with one injected list failure, three-second access tokens, and 300 ms latency showed the error state, then Retry recovered the list after token expiry without signing out. Retry focus remained on the results region.
- Source review identified paginator destruction and disappearing clear-button focus. Both were fixed and covered by tests that render the pending state before flushing the HTTP response.
- `npm run format:check` and `git diff --check` passed. No warnings or errors were captured in the final browser console check.

After failure testing, the temporary fault/expiry overrides were removed by restarting the API with its normal settings. The Angular preview and API remain running for the learner.

The mock/API contracts did not change in this checkpoint; their earlier 25-test API result remains historical. A dev-server restart was required after new lazy-route files were created during a running build. The preview uses port 4201 to preserve the existing process on 4200.

Candidate exercises and independent code review remain unrecorded. These are bounded workflow and keyboard checks, not a full accessibility audit.

## Checkpoint 6: Merchant wizard, drafts, and autosave

Implemented the five-step Business, Contact, Banking, Processing, and Review wizard with 19 typed fields, field validation, and processing-amount relationships. SALES can create a draft and reopen an owned DRAFT through the dashboard's role-aware New application/Edit draft actions. The actual root routes use role permission guards, and loaded records and API writes independently check edit permissions.

Draft restoration fills public values while keeping account/tax replacement inputs blank and displaying stored masks separately. Unchanged sensitive fields are omitted from writes; an edited blank preserves explicit clearing intent. Autosave marks edits unsaved immediately, debounces for 700 ms, serializes versioned PATCH requests, and retains one latest pending snapshot. Failed saves preserve inputs and support explicit retry; 409 conflicts pause writes until an explicit discard-and-load-server-copy decision. Submission flushes and awaits the final save before posting the acknowledged version. Navigation and explicit sign out share the pending-draft guard. See [Wizard](WIZARD.md).

Verification on 10 October 2026:

- `npm run test:ci`: 78 Angular tests passed across nine files.
- `npm run build`: passed without warnings; initial bundle 303.12 kB and lazy wizard chunk 74.89 kB. Existing bundle/style budgets are unchanged.
- Live restored-draft flow: opened seeded `app-001`, retained edited values through an injected save 503, chose Stay here when attempting to leave, and retried successfully after the temporary three-second access token expired. The saved merchant name was restored on return.
- Live banking/review flow: stored masks appeared beside blank replacement inputs; the review step and submission completed, the confirmation received focus, and the submitted dashboard row no longer offered Edit draft.
- Live new-draft flow: created a draft and saved incomplete Business values while required errors blocked Continue. Completed all five steps. An average ticket of 500 with a maximum of 100 blocked Continue with a visible cross-field error; correcting the maximum to 1000 allowed the masked review, showing only the expected account/tax endings.
- Live final-flush check: changed monthly volume from 10000 to 12000 and chose Continue and Submit before the autosave debounce elapsed. The UI showed Saving and submitting with actions disabled, then confirmed successful submission with focus on the Application submitted heading.
- Responsive review: the inspected wizard fit at 375px without horizontal overflow. The 1440px desktop review screenshot also showed no horizontal overflow. Final captured browser warning/error logs were empty.
- Conflict recovery was exercised through TestBed, not a live browser conflict scenario.
- Corrections during verification: fixed touched-field error rendering under OnPush; preserved server validators across step mounts; retained server errors until their own section changes; and prevented values outside draft wire bounds from being falsely labelled saved.
- `npm run format:check` and `git diff --check` passed.

After save-failure and refresh checks, the API was restarted with its normal demo settings and the preview was signed out. Restarting resets the fictional records. The API and Angular preview on port 4201 remain running for the learner. No API contract or mock-server changes were made; the earlier 25-test API result remains historical and was not rerun for this checkpoint.

The `feat/application-wizard` branch initially lacked the existing checkpoint 5 work. It was fast-forwarded to the user's existing commit `16bca90` before implementation. No new commit or push was performed. Candidate review and learner exercises remain unrecorded. The recorded browser flows and tests are bounded verification, not a full accessibility audit.

## Future checkpoints

## Checkpoint 7: Detail, assignment, review, and controlled reveal

Implemented the lazy application detail route and linked every dashboard merchant to it. The detail view shows the public form summary, assignment and review history, and role-aware actions. ADMIN users can assign or reassign a reviewer on submitted/in-review records. The assigned REVIEWER can record an approval or rejection with a risk level; rejection requires a note. ADMIN and the assigned REVIEWER can explicitly reveal stored banking values for the current session, while the default view remains masked and SALES has no reveal action.

The UI sends the server's current version for assignment and decisions, keeps server errors visible, and reloads safely after conflicts. Raw reveal values are held in component memory only and can be hidden again; they are not placed in URLs, browser storage, or the default detail response. The API remains the authorization boundary.

Verification on 10 October 2026:

- `npm run test:ci`: 80 tests passed across 10 files, including detail masking/reveal and rejection-note tests.
- `npm run build`: passed after adding the lazy detail chunk; the existing dashboard stylesheet budget was kept within its limit.
- Live Reviewer flow: assigned applications appeared in the scoped list; opening `app-003` showed masked banking data, the reveal request showed raw values only after the explicit action, and rejecting without a note was blocked with visible validation.
- Live Admin flow: an unassigned submitted application (`app-027`) loaded an explicit reviewer selector; assigning Demo Reviewer 02 changed the record to IN_REVIEW and updated its assigned reviewer.
- A lifecycle bug discovered during the first reveal click was corrected by passing the component `DestroyRef` to subscriptions created by event handlers.

The mock API contract and its earlier 25-test result remain unchanged. Full accessibility audit, broader keyboard review, and submission preparation remain future work. See [detail implementation notes](DETAIL.md).

## Future checkpoints

8. Complete accessibility and responsive checks, security documentation, meaningful regression tests, and submission preparation.

Update documentation and record verification during each checkpoint. Counts and real-time updates remain optional; prioritize completing the required workflows.

## Schedule and submission

The assignment expects six to eight hours of work and a return within three to five calendar days, with holiday flexibility. The plans mention 12 October 2026; that exact date remains unconfirmed from the supplied assignment. Track actual effort and confirm the deadline from the candidate's correspondence.

A private repository and reviewer access are submission work still to be completed. No repository publication, invitation, or external communication is recorded here.
