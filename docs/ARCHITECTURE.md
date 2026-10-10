# Architecture and decisions

This is a working design record, not a claim that every feature exists. The original assignment is the requirements source; the two supplied plans are suggestions. We will keep this document aligned with the code as each learning checkpoint is completed.

## Foundation

| Area             | Decision                                                     | Reason and status                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework        | Angular 21.2, standalone components, strict TypeScript       | The assignment permits Angular 20+. Angular 21 is the selected foundation for the installed Node 24.14 environment. Implemented; production build and initial component test passed. |
| Templates        | Built-in `@if` / `@for` control flow                         | Required modern Angular patterns; use stable identities when rendering lists.                                                                                                        |
| UI               | Angular Material with SCSS                                   | Allowed by the assignment. Provides consistent controls; labels, focus, responsive layout, and keyboard behavior still need verification.                                            |
| State            | Signals for current UI state; RxJS for asynchronous flows    | Keep synchronous state simple while expressing HTTP, timing, and cancellation explicitly.                                                                                            |
| Forms            | Typed Reactive Forms with custom validation                  | Typed login and merchant forms are implemented. Merchant submission validation includes field rules and processing-amount relationships, separate from draft-save bounds.            |
| Tests            | Vitest and Angular TestBed                                   | Required. Begin with a component smoke test, then test important behavior as it is added.                                                                                            |
| Routing          | Angular Router; lazy features and guards added with features | Public login and guarded lazy overview/applications routes are implemented; the root provider configuration registers the real authentication interceptor.                           |
| Change detection | `OnPush` for application components                          | A project choice. Signals read by a template notify Angular when their values change; inputs and handled events also matter.                                                         |

Avoid adding abstractions or feature folders before there is code that needs them. A future feature can own its page, API access, and tests; application-wide authentication belongs in a shared core area.

## Styling choice and visual quality

The assignment explicitly requests “Bootstrap 5 or Angular Material with SCSS responsive layouts.” Material and SCSS remain the current implementation choice because they match that requirement. Angular itself supports Tailwind; this is a requirement-driven choice, not an Angular restriction. See [Angular's Tailwind guide](https://angular.dev/guide/tailwind).

The candidate raised a concern that the checkpoint 1 screen was too basic for a senior submission. Checkpoint 2 replaced it with a responsive shell, consistent design tokens, a workspace overview, and a checklist interaction. Checkpoints 4 and 5 add sign-in and an application dashboard. Checkpoint 6 adds draft creation, editing, and submission; the administrator/reviewer workflow still needs its UI. Passing tests alone does not establish visual quality.

Preserve the shared palette, typography hierarchy, spacing scale, control sizing, and focus treatment as features expand. The dashboard now uses readable application lists and explicit loading, empty, error, and retry states. Future forms need validation and save feedback. Avoid adding nonfunctional controls to make the scaffold appear complete.

Tailwind could be an additional styling tool, but replacing the specified stack outright would depart from the brief. No Tailwind dependency has been added. A switch would need a clear benefit beyond visual polish, which either styling approach can deliver.

## Roles and workflow implemented by the mock API

These are conservative implementation assumptions, not extra requirements from the assignment. Checkpoint 3 implements them in the mock API and shared permission helpers. The supplied plans disagree about ADMIN permissions; frontend authentication, the dashboard, and the SALES draft wizard consume that contract. Administrator/reviewer action screens remain future work.

| Actor    | Permitted actions                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------- |
| SALES    | View own applications; create and edit own drafts; submit them.                                     |
| REVIEWER | View assigned applications; record an approval or rejection when review is allowed.                 |
| ADMIN    | View all applications and assign reviewers. Creation and risk decisions are not granted by default. |

Implemented lifecycle: `DRAFT → SUBMITTED → IN_REVIEW → APPROVED / REJECTED`. Submission belongs to the owner, assignment starts review, and only the assigned reviewer records the decision. Reopening or editing a submitted application is outside the initial scope.

The exact scope, fields, endpoints, and transition rules are recorded in [the API contract](API.md). The implemented reveal policy allows the assigned REVIEWER and ADMIN to request raw banking values; SALES can supply or replace sensitive draft values without receiving stored raw values back.

Route guards protect the authenticated workspace. The dashboard is available to all three roles and displays only the summaries returned by the server. The mock API already independently enforces role, ownership, assignment, and status checks. HTTP tests exercise direct calls, including forbidden actions.

## Design constraints and implementation status

- **Autosave (implemented):** Edits become unsaved immediately and debounce for 700 ms. Writes serialize with one latest pending snapshot. Conflicts keep the form and pause saving; submission flushes and awaits the final save. Cancelling an HTTP subscription cannot undo a server write.
- **Masked draft restoration (implemented):** Display metadata stays separate from blank editable secret controls. A pristine blank control may rely on an existing stored value. Dirty sensitive controls express replacement or explicit clearing intent; unchanged secrets are omitted from patches. Masks are never saved as real values.
- **Sensitive data:** Use synthetic data only. Keep raw values out of URLs, logs, browser persistence, and default detail responses. Role checks belong on the reveal endpoint as well as in the UI.
- **CSP:** Explain it as defense in depth. A production policy must protect the served HTML document; setting a header only on JSON API responses does not protect the Angular page. CSP does not replace authorization or safe rendering.

Checkpoint 3 implemented backend masking, authorization, version conflicts, and token expiry/rotation. Frontend refresh coordination is implemented in checkpoint 4 and used by the checkpoint 5 dashboard. Client autosave and safe draft restoration are implemented in checkpoint 6. Reviewer reveal controls and the served document's CSP remain future work.

## Scope boundary

Prioritize the required dashboard, application wizard, draft saving, review detail, permissions, refresh flow, and meaningful tests. Dashboard counts and real-time updates remain optional. The original expectation is six to eight hours of implementation effort; learning time and actual effort will be recorded separately where useful. The plans' stated 12 October deadline has not been independently confirmed.

## Historical foundation verification

Checked on 9 October 2026 with Node 24.14.0 and npm 11.9.0. Installed versions are locked in `package-lock.json`: Angular core 21.2.25, CLI 21.2.26, Material 21.2.14, and Vitest 4.1.11. The production build passed without warnings, and the TestBed rendering smoke test passed. Desktop and 375px browser checks verified readable layout, no horizontal overflow, and keyboard access to the main content. Full workflow and accessibility checks remain future work.

References: [Angular version compatibility](https://angular.dev/reference/versions), [Angular testing](https://angular.dev/guide/testing), and [Material theming](https://material.angular.dev/guide/theming).

## Checkpoint 2 component boundaries (history)

At checkpoint 2, `App` owned the responsive Material sidenav, skip link, navigation, and router outlet. These shell responsibilities now live in `WorkspaceShell`, while `App` contains only the root router outlet. `Workspace` owns the `/overview` page content and loads through `loadComponent`. `ApplicationChecklist` is a dialog that both navigation and the overview can open; it does not submit data. `Icon` supplies the repeated decorative SVG glyphs, while button or link labels provide accessible names.

`BreakpointObserver` emits viewport changes as an Observable. `toSignal` exposes its current mobile/desktop state to the template and handles subscription cleanup. A separate `navigationOpen` signal stores the user-controlled mobile drawer state. These are UI states, not authentication or permission state.

Global CSS custom properties live in `src/styles/_tokens.scss`. Material theme overrides consume the same accent/surface/canvas tokens. Component SCSS handles each component's layout; the decorative illustration stays in a local SVG asset so it does not inflate the page stylesheet. No new npm dependencies were needed for this checkpoint.

## Checkpoint 3 boundaries and tradeoffs

`shared/` contains framework-independent TypeScript contracts and permission predicates. Types describe the contract at compile time; `mock-api/validation.ts` separately validates untrusted request data at runtime. The browser imports shared contracts, never the mock server or its seed data.

`createMockApi()` builds an Express app with isolated in-memory stores; `server.ts` handles environment settings and listening. Tests create fresh apps and inject time to check expiration without sleeping. The server uses opaque tokens because the assignment needs bearer authentication and refresh behavior, not a JWT implementation. Expired sessions are removed during session operations.

Internal `ApplicationRecord` holds raw banking fields. Explicit response mappers construct `ApplicationSummary` and `ApplicationDetail`, excluding those values by default. Separate masked/present metadata supports draft restoration. Only the authorized reveal route returns raw banking values.

Each mutation sends the last-read `version`. The server checks it and writes synchronously, with no asynchronous gap between comparison and mutation. This rejects stale writes; it does not implement client autosave. A real database would need atomic persistence. Incomplete drafts can be stored, while submission runs full validation against the saved form.

Angular's development proxy keeps browser API URLs relative. The Node API and its dependencies are development tools and are not part of the Angular browser bundle. Deployment routing and CSP remain to be decided when the complete application is ready. See [security notes](SECURITY.md) for mock limitations.

## Checkpoints 4 and 5: current frontend boundaries

`app.config.ts` registers `provideHttpClient(withInterceptors([authInterceptor]))` and the actual route configuration. Keeping these providers in integration tests matters: testing a service alone would not catch an application that forgot to register its interceptor or protected routes.

`App` hosts a router outlet. `/login` loads the login page through `guestGuard`; the authenticated parent uses `authGuard` and `authChildGuard` and lazily loads `WorkspaceShell`. Its children include `/overview`, `/applications`, and the new/edit wizard routes described below. The root still defaults to overview. The shell displays the authenticated name and role, consults any draft leave safeguard before explicit sign out, closes dialogs/navigation after confirmation, and updates its breadcrumb after router navigation. A direct applications visit returns there after authentication.

`AuthService` stores the session in memory using signals. The HTTP interceptor only attaches credentials to the trusted relative API, coordinates one refresh for concurrent 401s, handles late failures with the current token, and retries once. Session revisions stop old login/refresh responses from restoring a logged-out user or replacing a newer session. Reloading the browser loses the local session. See [authentication](AUTHENTICATION.md) for the lifecycle and tradeoffs.

`Applications` provides its own `ApplicationsStore`, so list state is scoped to that route visit. The store exposes query and result signals; RxJS coordinates HTTP reads. It requests page 1 immediately, debounces merchant search by 300 ms, resets the page on filter/page-size changes, and converts Material's zero-based page index to the API's one-based page. Search/status filtering and totals belong to the API after role scoping; the browser does not fetch all records to filter locally.

A changed query cancels the previous read immediately, including while the next search is debouncing. Errors are caught inside the request flow, preserving later filters and retries. Explicit loading, success, and error states drive the template; success also handles empty results and an out-of-range page. The store is destroyed with the page, and filters are not persisted or synchronized to URL query parameters. See [dashboard behavior](DASHBOARD.md).

The dashboard renders summaries and now offers New application to SALES and Edit draft for an own DRAFT. It does not offer administrator assignment, reviewer decisions, or general detail links yet. Current verification results belong in [the progress log](PROGRESS.md).

## Checkpoint 6: merchant drafts and submission

`/applications/new` and `/applications/:id/edit` lazily load `ApplicationWizard` behind the appropriate shared permission guard. The new route presents a start screen; an explicit Create draft action sends the POST and opens its returned edit URL. Loaded records are checked with `canEditApplication` before editing, while the API independently enforces role, owner, and DRAFT state.

The five-step flow is Business, Contact, Banking, Processing, and Review. `merchant-form.ts` creates four typed nested groups and keeps submission validity separate from whether a partial draft can be sent. Numeric controls can be null while editing; snapshots map those blanks to zero for the draft API. Submission requires positive finite amounts and `averageTicket ≤ maxTicket ≤ monthlyVolume`.

`restoreMerchantForm` resets public values as a pristine baseline and leaves account/tax inputs blank. Stored presence metadata satisfies an unchanged blank secret; dirty blanks represent explicit clearing and cannot satisfy submission. `draftSnapshot` includes only dirty sensitive controls. The parent restores only on initial load or explicit reload, so a save response cannot overwrite edits made while that request was pending.

A component-scoped `DraftAutosave` keeps one PATCH in flight and coalesces subsequent edits into one latest snapshot. Each write uses the last acknowledged version. A lost response is treated as unconfirmed; even an undo needs reconciliation. A 409 pauses writes and retains the local form until the user chooses to discard edits and load the server copy. Save now bypasses debounce, and submit waits for the latest acknowledgement before its own versioned POST. The form is disabled while saving for submission and submitting.

Router deactivation and the shell's explicit sign-out use the same leave check. Unsaved work offers Stay, Save and leave when available, or Leave without saving. Saving conflicts require explicit resolution; leaving during submission is blocked. A beforeunload handler requests the browser's native warning, but does not synchronously save. Destroying the page cancels local subscriptions; it cannot roll back a write already accepted by the server. There is no browser-persisted draft mirror, so reload requires login and can restore only server-confirmed data. See [the wizard guide](WIZARD.md).
