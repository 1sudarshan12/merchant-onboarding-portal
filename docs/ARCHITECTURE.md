# Architecture and decisions

This is a working design record, not a claim that every feature exists. The original assignment is the requirements source; the two supplied plans are suggestions. We will keep this document aligned with the code as each learning checkpoint is completed.

## Foundation

| Area             | Decision                                                     | Reason and status                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework        | Angular 21.2, standalone components, strict TypeScript       | The assignment permits Angular 20+. Angular 21 is the selected foundation for the installed Node 24.14 environment. Implemented; production build and initial component test passed. |
| Templates        | Built-in `@if` / `@for` control flow                         | Required modern Angular patterns; use stable identities when rendering lists.                                                                                                        |
| UI               | Angular Material with SCSS                                   | Allowed by the assignment. Provides consistent controls; labels, focus, responsive layout, and keyboard behavior still need verification.                                            |
| State            | Signals for current UI state; RxJS for asynchronous flows    | Keep synchronous state simple while expressing HTTP, timing, and cancellation explicitly.                                                                                            |
| Forms            | Typed Reactive Forms with custom validation                  | Required. Specific merchant fields and wizard steps are design choices to settle before implementation.                                                                              |
| Tests            | Vitest and Angular TestBed                                   | Required. Begin with a component smoke test, then test important behavior as it is added.                                                                                            |
| Routing          | Angular Router; lazy features and guards added with features | Required eventual behavior. A scaffold containing router configuration does not by itself demonstrate lazy loading or access control.                                                |
| Change detection | `OnPush` for application components                          | A project choice. Signals read by a template notify Angular when their values change; inputs and handled events also matter.                                                         |

Avoid adding abstractions or feature folders before there is code that needs them. A future feature can own its page, API access, and tests; application-wide authentication belongs in a shared core area.

## Styling choice and visual quality

The assignment explicitly requests “Bootstrap 5 or Angular Material with SCSS responsive layouts.” Material and SCSS remain the current implementation choice because they match that requirement. Angular itself supports Tailwind; this is a requirement-driven choice, not an Angular restriction. See [Angular's Tailwind guide](https://angular.dev/guide/tailwind).

The candidate raised a concern that the checkpoint 1 screen was too basic for a senior submission. Checkpoint 2 replaces it with a responsive shell, consistent design tokens, a workspace overview, and a checklist interaction. This improves the visual foundation; the final application dashboard and workflows still need to be built and reviewed. Passing tests alone does not establish visual quality.

Before expanding the UI, establish a consistent palette, typography hierarchy, spacing scale, control sizing, and focus treatment. As features arrive, use a task-focused application shell, clear role-aware actions, readable application lists, and designed loading, empty, error, validation, and save states. Avoid adding nonfunctional controls to make the scaffold appear complete.

Tailwind could be an additional styling tool, but replacing the specified stack outright would depart from the brief. No Tailwind dependency has been added. A switch would need a clear benefit beyond visual polish, which either styling approach can deliver.

## Roles and workflow implemented by the mock API

These are conservative implementation assumptions, not extra requirements from the assignment. Checkpoint 3 implements them in the mock API and shared permission helpers. The supplied plans disagree about ADMIN permissions; the frontend will use the same documented contract when its features are added.

| Actor    | Permitted actions                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------- |
| SALES    | View own applications; create and edit own drafts; submit them.                                     |
| REVIEWER | View assigned applications; record an approval or rejection when review is allowed.                 |
| ADMIN    | View all applications and assign reviewers. Creation and risk decisions are not granted by default. |

Implemented lifecycle: `DRAFT → SUBMITTED → IN_REVIEW → APPROVED / REJECTED`. Submission belongs to the owner, assignment starts review, and only the assigned reviewer records the decision. Reopening or editing a submitted application is outside the initial scope.

The exact scope, fields, endpoints, and transition rules are recorded in [the API contract](API.md). The implemented reveal policy allows the assigned REVIEWER and ADMIN to request raw banking values; SALES can supply or replace sensitive draft values without receiving stored raw values back.

Route guards and hidden controls will guide navigation. The mock API already independently enforces role, ownership, assignment, and status checks. HTTP tests exercise direct calls, including forbidden actions.

## Design constraints for later checkpoints

- **Autosave:** Debounce edits, but mark them unsaved immediately. Cancelling an HTTP subscription cannot undo a server write. Serialize writes, retain the latest pending snapshot, and handle version conflicts without discarding the form. Flush and await the final save before submission. Catch errors inside the ongoing save flow so subsequent edits can still save.
- **Masked draft restoration:** Keep masked display values separate from form input values. Return stored-value presence metadata; accept either an existing sensitive value or a valid replacement. Omit unchanged sensitive fields from patches. Never save a string of masking characters as the real value.
- **Authentication refresh:** Attach bearer tokens only to the trusted API. Share one refresh request between concurrent 401 responses and retry each failed request at most once. A late 401 can use an already replaced token. Clear shared refresh state at the source lifecycle, and distinguish refresh failures from errors returned by the retried application request.
- **Sensitive data:** Use synthetic data only. Keep raw values out of URLs, logs, browser persistence, and default detail responses. Role checks belong on the reveal endpoint as well as in the UI.
- **CSP:** Explain it as defense in depth. A production policy must protect the served HTML document; setting a header only on JSON API responses does not protect the Angular page. CSP does not replace authorization or safe rendering.

The backend portions of masking, authorization, version conflicts, and token expiry/rotation are implemented and tested in Checkpoint 3. Client autosave, refresh coordination, reveal controls, and the served document's CSP remain future work.

## Scope boundary

Prioritize the required dashboard, application wizard, draft saving, review detail, permissions, refresh flow, and meaningful tests. Dashboard counts and real-time updates remain optional. The original expectation is six to eight hours of implementation effort; learning time and actual effort will be recorded separately where useful. The plans' stated 12 October deadline has not been independently confirmed.

## Foundation verification

Checked on 9 October 2026 with Node 24.14.0 and npm 11.9.0. Installed versions are locked in `package-lock.json`: Angular core 21.2.25, CLI 21.2.26, Material 21.2.14, and Vitest 4.1.11. The production build passed without warnings, and the TestBed rendering smoke test passed. Desktop and 375px browser checks verified readable layout, no horizontal overflow, and keyboard access to the main content. Full workflow and accessibility checks remain future work.

References: [Angular version compatibility](https://angular.dev/reference/versions), [Angular testing](https://angular.dev/guide/testing), and [Material theming](https://material.angular.dev/guide/theming).

## Checkpoint 2 component boundaries

`App` owns the responsive Material sidenav, skip link, navigation, and router outlet. `Workspace` owns the `/overview` page content and loads through `loadComponent`. `ApplicationChecklist` is a dialog that both navigation and the overview can open; it does not submit data. `Icon` supplies the repeated decorative SVG glyphs, while button or link labels provide accessible names.

`BreakpointObserver` emits viewport changes as an Observable. `toSignal` exposes its current mobile/desktop state to the template and handles subscription cleanup. A separate `navigationOpen` signal stores the user-controlled mobile drawer state. These are UI states, not authentication or permission state.

Global CSS custom properties live in `src/styles/_tokens.scss`. Material theme overrides consume the same accent/surface/canvas tokens. Component SCSS handles each component's layout; the decorative illustration stays in a local SVG asset so it does not inflate the page stylesheet. No new npm dependencies were needed for this checkpoint.

## Checkpoint 3 boundaries and tradeoffs

`shared/` contains framework-independent TypeScript contracts and permission predicates. Types describe the contract at compile time; `mock-api/validation.ts` separately validates untrusted request data at runtime. The browser will import shared contracts, never the mock server or its seed data.

`createMockApi()` builds an Express app with isolated in-memory stores; `server.ts` handles environment settings and listening. Tests create fresh apps and inject time to check expiration without sleeping. The server uses opaque tokens because the assignment needs bearer authentication and refresh behavior, not a JWT implementation. Expired sessions are removed during session operations.

Internal `ApplicationRecord` holds raw banking fields. Explicit response mappers construct `ApplicationSummary` and `ApplicationDetail`, excluding those values by default. Separate masked/present metadata supports draft restoration. Only the authorized reveal route returns raw banking values.

Each mutation sends the last-read `version`. The server checks it and writes synchronously, with no asynchronous gap between comparison and mutation. This rejects stale writes; it does not implement client autosave. A real database would need atomic persistence. Incomplete drafts can be stored, while submission runs full validation against the saved form.

Angular's development proxy keeps browser API URLs relative. The Node API and its dependencies are development tools and are not part of the Angular browser bundle. Deployment routing and CSP remain to be decided when the complete application is ready. See [security notes](SECURITY.md) for mock limitations.
