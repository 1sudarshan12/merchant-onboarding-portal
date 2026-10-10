# Learning log

Work in small checkpoints: understand the purpose, make a change, observe its behavior, and explain the result. Completion means there is evidence the code works; reading this document alone does not demonstrate understanding.

## Checkpoint 1 — Angular foundation

**Goal:** Start the app, understand its entry points, and run a first component test. Business functionality is deliberately deferred to later checkpoints.

**Implementation status:** Complete for checkpoint 1. Angular 21, strict TypeScript, standalone root component with OnPush, Material/SCSS theme, router registration, and a Vitest/TestBed smoke test are in place. Business features remain future work.

**Validation status:** `npm run build` passed; `npm run test:ci` passed (one test). The page was inspected at desktop width and a 375px phone viewport, with no horizontal overflow or captured browser warnings/errors. Keyboard Tab and Enter moved focus through the skip link into the main content. This is a basic check, not a full accessibility audit.

### How the application starts

1. `src/main.ts` is the browser entry point. It calls `bootstrapApplication` with the root standalone component and the application configuration.
2. `src/app/app.config.ts` supplies application-wide services and behavior. Router registration belongs here; HTTP configuration will be added when needed.
3. `src/app/app.routes.ts` maps URLs to content. The router uses this configuration; it is not another bootstrap step. Lazy routes and guards will arrive with actual features.
4. The root component in `src/app/app.ts` describes its selector, imported template dependencies, template, and styles. A standalone component declares the dependencies its own template uses.
5. `src/app/app.html` renders that component's view. `src/app/app.scss` styles it; `src/styles.scss` holds application-wide styles and the Material theme.

The browser loads the JavaScript built from these files. Angular creates the root component, connects state to its template, and lets the router render matched route content when routes are defined.

### State and rendering

A signal stores a current value. A template reads it by calling it, for example `title()`. Updating it with `.set(...)` informs Angular that its consumers need an update. A `computed` signal derives a value from other signals.

`OnPush` narrows when Angular checks a component. It does not mean the component can never update: changed inputs, handled events, and changes to signals read in its template can schedule updates. We will use a real feature to explore this before introducing more state machinery.

Signals represent current state. RxJS represents asynchronous events and operations over time. Later, a dashboard can store the current query in signals while RxJS handles debounced requests and stale responses.

### What the first test proves

Vitest runs the test. Angular TestBed creates a component in an Angular testing environment. A useful initial smoke test checks that the root component can render its intended starting content.

Passing that test demonstrates the basic test setup and component wiring. It does not prove that authentication, permissions, API integration, accessibility, or application workflows work. Those need their own checks when implemented.

### Small learner exercise

After the foundation runs:

1. Find the root template and change one visible sentence.
2. Observe the change in the browser and identify which file controlled its appearance.
3. If the test asserts the changed text, run it and explain the failure before updating the expectation.
4. Explain aloud: “The entry point starts Angular; configuration supplies services; the component connects state, template, and styles.”

Record questions or surprising behavior below. Do not mark this exercise complete until you have tried it.

**Learner notes:** Not yet recorded.

## Styling discussion — SCSS, Tailwind, and Material

These tools have different responsibilities:

- **SCSS** is a Sass syntax for writing styles, including nesting and reusable mixins. Our `styles.scss` configures the Material theme; `app.scss` defines the page layout and appearance.
- **Tailwind** provides utility classes used in HTML, such as `flex`, `gap-4`, and `md:grid-cols-3`. It works with Angular as well as React; see the [official Angular integration guide](https://angular.dev/guide/tailwind).
- **Angular Material** provides Angular components and their interaction behavior. Styling a table with utility classes alone does not implement pagination, sorting, or keyboard behavior.

The assignment asks for Material or Bootstrap with SCSS responsive layouts, which is why Material and SCSS were selected. This does not mean Angular requires SCSS or that SCSS produces a more professional interface than Tailwind. Familiarity with Tailwind can make writing styles faster, but visual quality still comes from layout, hierarchy, spacing, consistency, and useful interaction states.

The current screen is a foundation exercise. Its visual direction needs improvement before submission. The proposed next UI work is a consistent design foundation and a task-focused shell, followed by real feature controls as their behavior is implemented. No styling-stack migration has been made during this discussion.

## Checkpoint 2 — Visual foundation and a routed shell

**Implemented:** A responsive shell, lazy `/overview` page, shared design tokens, inline SVG icons, a local decorative illustration, and a working Material checklist dialog. The files discussed in checkpoint 1 have evolved: `app.html` now renders the frame; the overview content lives in `features/workspace/workspace.html`.

### Separate the frame from the page

The shell is the part that remains while pages change: brand, navigation, header, and main landmark. The router outlet is the place where the selected page appears. In `app.routes.ts`, `loadComponent` uses a dynamic import for `Workspace`, so the build produces a separate workspace chunk. Authentication and route guards are still future work; lazy loading is not an authorization boundary.

### Give design choices names

`--color-accent` names a purpose rather than a particular shade. Components read it using `var(--color-accent)`, and Material's theme overrides consume it too. This lets a single change update shared emphasis consistently. SCSS organizes the stylesheet; the CSS custom property remains available at runtime. The full rules are in [the design guide](DESIGN.md).

### Make responsive behavior explicit

CSS changes content layout at smaller widths. For the drawer's behavior, `BreakpointObserver` emits whether the viewport is mobile; `toSignal` converts that Observable into a value the template can read as `isMobile()`. The separate `navigationOpen` signal remembers whether the user opened the mobile drawer. Desktop navigation stays visible; mobile navigation opens above the page with a backdrop and keyboard focus handling supplied by Material.

### Test interactions at their real boundaries

TestBed renders the shell with the actual route configuration. One test follows `/` to `/overview` and checks the page and active navigation. The second opens the checklist and waits for the dialog's `afterClosed()` event before asserting that it disappeared. Waiting for Angular to stabilize alone does not necessarily wait for Material's closing animation.

Browser checks additionally exercised mobile navigation, dialog focus containment, Escape dismissal, nested drawer/dialog focus restoration, and the skip link. A plain `#main-content` link can resolve against Angular's base URL, so the click handler prevents navigation and focuses the existing main element directly.

### Try it yourself

1. Open `src/styles/_tokens.scss`, temporarily change `--color-accent`, and inspect the primary button and labels. Restore the value afterwards.
2. Narrow the browser and open the navigation. Trace the menu button to `navigationOpen.set(true)` in the template.
3. Open the checklist, use Tab to cycle through it, then press Escape. Observe where focus returns.
4. Explain why the shell and workspace are separate components and why opening a checklist is different from creating an application.

**Learner exercise status:** Not yet recorded. These notes document implementation and verification by Codex, not a claim that the candidate has already reviewed or understood every change.

## Checkpoint 3 — Contracts, permissions, and the mock API

**Implemented:** Shared models and permission helpers, a local API with 30 fictional applications and five demo users, expiring/rotating sessions, scoped lists, versioned draft writes, submission/review transitions, masked responses, and controlled reveal. The [API contract](API.md) describes every request. The visible Angular pages have not connected to it yet.

### Read one request from end to end

Start with `PATCH /api/applications/:id` in `mock-api/app.ts`:

1. `requireAuth` resolves the bearer token to a user. Authentication answers “Who is making this request?”
2. Role, ownership, and status checks decide whether this user can edit this particular draft. Authorization answers “Is that action allowed here?”
3. `objectBody` and `parseFormPatch` reject unknown fields and incorrect runtime types. TypeScript alone cannot protect an HTTP boundary because the caller can send arbitrary JSON.
4. `checkVersion` rejects an outdated copy; `mergeForm` preserves fields omitted by the patch.
5. The server updates the record, increments its version, and constructs a masked public response.

The frontend will hide unavailable controls for clarity, but calling the API directly must still fail when permission is missing.

### Saving a draft is different from submitting it

A user can save while an email is incomplete or a required field is blank. Therefore draft validation checks the shape and safe bounds of data; submission checks business completeness. The latter can return several dotted field errors so the future form can show them beside their inputs.

Optimistic concurrency means sending the version you last read. If two requests both use version 1, the first accepted write creates version 2. The second gets 409 and must not silently overwrite the newer data. The future autosave coordinator must retain the user's local edits when that happens.

### A masked value is display information

`•••• 1001` tells the user that an account value is already saved. It is not an account number to put into an editable form control. `ApplicationDetail` separates `sensitive` metadata from `form`; unchanged secret fields are omitted from patches. The server retains their actual values and validates them on submission.

Account numbers use `string`, even though they contain digits: converting `0000000000001001` to a number would lose leading zeros. Processing amounts, which participate in comparisons, use `number`.

### Understand the error before choosing the UI response

| Status | Meaning                                                         | Later frontend behavior                                        |
| ------ | --------------------------------------------------------------- | -------------------------------------------------------------- |
| 401    | Session credential is absent, expired, or invalid.              | Attempt coordinated refresh, or return to login.               |
| 403    | The authenticated user lacks permission.                        | Explain the restriction; do not try refreshing to gain a role. |
| 409    | The record changed or the workflow state disallows the action.  | Preserve local edits and resolve/reload the conflicting state. |
| 422    | The request cannot complete because business validation failed. | Show relevant field errors.                                    |
| 503    | Temporary simulated failure.                                    | Keep current state and offer retry.                            |

The current tests use an injected clock for expiration, rather than waiting 30 seconds. HTTP integration tests use a fresh in-memory app for each case. Angular TestBed remains responsible for component behavior; Node API tests have their own Vitest configuration.

### Try it yourself

1. Run `npm run dev`. Visit `http://localhost:4200/api/health`; explain how the Angular proxy reaches port 3000.
2. Read `shared/models.ts`, then find where `responses.ts` turns an internal record into an `ApplicationDetail`. Identify the fields it deliberately omits.
3. In a REST client, sign in as `sales1@example.test` with `Demo#1234`, then read `app-001` using the returned bearer token. The [API contract](API.md) contains the paths and payload shapes.
4. PATCH its legal name using the current version. Repeat the same PATCH with the old version and observe 409. Refresh your access token if it expires during the exercise.
5. Try reading `app-002` as that sales user and explain the 403. Then explain why a hidden Edit button would not be enough protection.

**Learner exercise status:** Not yet recorded. Review one endpoint and its test before moving on; these notes do not claim you have already completed the exercises.

## Checkpoint 4 — Authentication

**Implemented:** Typed login form, in-memory session signals, route guards, authenticated shell, bearer interceptor, one shared refresh for concurrent 401 responses, and logout. Read [Authentication](AUTHENTICATION.md) for the request lifecycle and the session-revision protection against late responses.

Authentication identifies the user; authorization checks their permitted action. A route guard improves navigation, while the API remains responsible for role and record checks. A successful refresh followed by a failed business request must show that request's error rather than sign the user out.

Tokens live in memory, so reloading the browser starts a new login. Leaving a page idle does not itself refresh credentials; the next protected request discovers expiry. TestBed HTTP tests exercise concurrent requests, late responses, refresh failure, and logout races.

**Learner exercise:** Read the interceptor test where refresh succeeds but the retried request returns 500. Explain why the user stays signed in. Then locate the guard and the matching API permission check and describe their different responsibilities. Exercise completion is not yet recorded.

## Checkpoint 5 — A dashboard backed by server queries

**Implemented:** Protected Applications navigation; responsive table/cards; server pagination; debounced merchant search; status filtering; loading, empty, error, and retry states. [Dashboard](DASHBOARD.md) explains the files and implementation tradeoffs. The root configuration also reconnects the existing authentication files to the actual app; integration tests now use that configuration.

### Signals hold a value; RxJS coordinates work

`store.query()` answers “Which page and filters are selected now?” `store.state()` answers “Are results loading, available, or failed?” These are signals because the template needs their current values.

Typing, changing a status, and clicking Next produce events over time. RxJS coordinates their HTTP requests. The outer `switchMap` cancels the previous read immediately; its inner timer waits 300 ms for search. If you type again, both a pending timer and an older HTTP subscription can be cancelled. This prevents an old response from appearing under newer filter controls.

Search debouncing and stale-response cancellation solve different problems. Debouncing reduces unnecessary requests; cancellation ensures only the current request can update this screen. Cancelling a read is safe here. A future draft write may already have reached the server, so autosave will require a different strategy.

### A server page is not the whole collection

For Sales, the server may return 10 rows with a total of 15. Render those 10 rows and pass 15 to the paginator. Filtering just those 10 rows locally would miss matching merchants on the other page and show a misleading total.

Material emits index 0 for the first page; the API expects page 1. `setPage` translates between them. Changing search, status, or page size returns to the first page so a previously valid page number does not hide a smaller result set.

The server first scopes records to the user, then filters and counts them. A role label or hidden button cannot provide that protection. The frontend only explains why Sales, Reviewer, and Admin see different lists.

### Keep the stream and keyboard interaction alive

`catchError` belongs inside the individual request. If an error ended the outer event stream, clicking Retry or changing a filter would no longer trigger work. A regression test fails one query, retries it, then changes the status to verify continued operation.

Rendering a loading state can also destroy focused controls. Review caught this with the paginator: removing it while loading sent keyboard focus away. It now stays mounted. Clear buttons deliberately focus the search input before disappearing; Retry focuses the persistent results region. Test and inspect the transition itself, not just the final successful screen.

### Try it yourself

1. Sign in with the Sales demo and open **Applications**. Find the 15-record total and the 10 rows on page one; click Next and observe the remaining five.
2. Select Draft. Explain why the page resets and why only three seeded records match. Search for `21`, then a nonexistent merchant name; use Clear filters to recover.
3. Trace search from `applications.ts` through `applications.store.ts` to `applications.api.ts`. Identify which file knows about controls, cancellation, and HTTP parameters respectively.
4. Read the cancellation test. Explain why it checks that the old request was cancelled before advancing the 300 ms timer.
5. Explain what would go wrong if we copied this read-cancellation approach directly into autosave.

**Learner exercise status:** Not yet recorded. Test results demonstrate the implementation; you should still run and explain these interactions yourself.

## Checkpoint 6 — Typed wizard and reliable autosave

**Implemented:** Five wizard steps, typed nested Reactive Forms, field and cross-field validators, explicit draft creation, restoration, automatic saving, review/submit, and leave/sign-out safeguards. Read [the wizard guide](WIZARD.md) for the design and its limits.

### Validation has two different jobs

Submission asks whether the application is complete and consistent. Saving a draft asks whether the server can safely store the current partial data. An incomplete email can be saved while still blocking Continue. A non-finite or negative processing amount cannot be sent under this API contract, so its local edit remains unsaved until corrected.

The four nested form groups match the domain sections. Processing has a group validator because comparing average, maximum, and monthly amounts requires multiple controls. Numeric controls allow null when cleared; account numbers remain strings to preserve leading zeros.

### Follow two overlapping edits

Suppose version 1 contains name A. You type B, and a save starts with version 1. Before it returns, you type C. The screen continues showing C; it never patches itself back to B from the older response. When B succeeds with version 2, the next due save sends C with version 2. Only after that response does the indicator say all changes are saved.

This uses a single active request and one latest pending snapshot. RxJS debounces the edit events; the coordinator serializes the writes. Unlike cancelling dashboard reads, cancelling a write cannot undo a server commit.

### A failure is not always a rejection

If a save returns a deliberate 503 before mutation, retry can use the same version. If the network loses the response, we may not know whether it committed. Retrying with the last acknowledged version lets the server detect that uncertainty as a conflict. The UI keeps local edits and asks for an explicit decision before loading the server copy.

Submission first waits for the final save and then uses its returned version. “Clicked Save” and “server confirmed Saved” are different events. That distinction prevents submitting older data.

### Keep masks out of form values

A restored account field is blank, with a separate saved-value hint. An untouched field is omitted from saves. A replacement is sent as a string; editing and clearing explicitly clears the saved value. The review screen masks the replacement too. The server checks stored values at submission because the browser cannot validate a hidden number from a mask.

### Try it yourself

1. Sign in as Sales, select New application, and create a draft. Enter only a legal name; observe Unsaved → Saving → Saved despite other required fields being incomplete.
2. Click Continue. Identify the missing field errors, and locate their validators in `merchant-form.ts`.
3. Open the seeded `app-001` draft. Visit Banking and verify that inputs are blank while saved masks appear below them. Change only the bank name; inspect the snapshot test that proves account/tax values are omitted.
4. Run the autosave test for overlapping edits. Explain which version each PATCH uses and why a response never replaces newer input.
5. With unsaved changes, navigate away and choose Stay here. Explain why a failed Save and leave must also keep the form open.
6. Explain the lost-response test: why can returning to the old value still require a server request?

**Learner exercise status:** Not yet recorded. Review the code and try these steps before treating the implementation as something you can explain in an interview.

## Next checkpoint

Checkpoint 7 adds the application detail page, risk history, administrator assignment, reviewer decisions, and controlled sensitive-field reveal.
