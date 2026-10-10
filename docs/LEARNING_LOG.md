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

## Next checkpoint

Checkpoint 4 connects Angular to authentication: login UI, session state, the bearer/refresh interceptor, and route access control. We will specifically test that simultaneous 401 responses share one refresh request and that a failed retry does not accidentally clear a valid session.
