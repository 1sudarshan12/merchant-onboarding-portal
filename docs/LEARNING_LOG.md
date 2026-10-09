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

## Next checkpoint

Agree on one permission and API contract, then build the first small workflow with its tests. Explain the server's authorization responsibility before adding guards or hiding controls in the UI.
