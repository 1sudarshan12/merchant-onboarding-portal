# Application dashboard: checkpoints 5 and 6

The protected `/applications` page lists the current user's permitted merchant applications. It supports server pagination, merchant-name search, status filtering, and loading, empty, failure, and retry states. Desktop uses a semantic table; narrow screens show the same summaries as labelled cards.

SALES can now choose New application or Edit draft for an owned DRAFT. The list still contains summaries only and never displays banking fields. General application detail and administrator/reviewer actions belong to later checkpoints; there are no placeholder action links.

## Follow one interaction

1. `Applications` connects its search `FormControl`, status select, and Material paginator to `ApplicationsStore`.
2. The store updates a query signal containing `page`, `pageSize`, `search`, and `status`. Search/status/page-size changes reset to page 1.
3. A request event enters `switchMap`, which unsubscribes the previous read immediately. Search waits 300 ms; paging, status changes, and Reload run immediately.
4. `ApplicationsApi` creates `HttpParams` and requests `GET /api/applications`. The application-wide interceptor supplies authentication and refresh handling.
5. The server applies the authenticated user's scope, then filters, counts, sorts, and slices. The browser renders the returned items and total without applying another slice or filtering just one page.
6. The response becomes a success state. Failure becomes an error state with a retry action; a 15-second timeout also releases a stuck request into that state.

The API uses pages starting at **1**; Material's paginator uses indexes starting at **0**. Conversion happens at the store boundary. Available page sizes are 10, 25, and 50.

## State and concurrency

Signals expose current query and result state to the `OnPush` template. The state union permits loading, success with a server page, or error with a message. Templates narrow this union with built-in control flow.

RxJS handles the sequence of requests. Cancellation happens before the search debounce: an older request cannot replace the display while the next search waits to start. A debounce placed before the outer `switchMap` would leave that older request subscribed for another 300 ms.

`catchError` is inside each request's inner stream. It converts one failure to an error state while keeping the outer stream available for retry and later filters. `takeUntilDestroyed` cancels outstanding work when the page and its component-scoped store are destroyed.

This cancellation policy applies to reads. The checkpoint 6 wizard uses serialized, versioned writes instead: it retains one latest pending snapshot and waits for an in-flight save before starting another. Unsubscribing cannot undo a write already accepted by the server. See [the wizard guide](WIZARD.md).

## Permissions and navigation

- SALES sees its own applications (15 for each seeded Sales account).
- REVIEWER sees assigned applications (9 for each seeded Reviewer account).
- ADMIN sees all 30 seeded applications.

These totals describe the initial seed and change as SALES creates applications or records move through the workflow. The role description is explanatory text, not client-side authorization. No owner or reviewer parameter is supplied by the UI to define its own scope.

New application opens `/applications/new`, where Create draft performs the actual POST. Edit draft opens `/applications/:id/edit` only for an owned DRAFT, using the shared `canEditApplication` rule. Both routes also have permission guards, and the API enforces ownership and status on every write. Submitted or terminal records do not offer an edit action. The list refreshes from the server when revisited after the wizard.

The actual application configuration registers `HttpClient` with the auth interceptor. Guards protect the shell and its children; `/applications` is also an allowed login return destination. Integration tests use the real `appConfig` to catch missing providers or route wiring.

## Interaction details and tradeoffs

- Filters remain usable while requests load. Results show a loading state instead of presenting old rows under new filters.
- A filtered empty result offers Clear filters. An unfiltered empty result explains that permitted records will appear here. If a previously valid page becomes empty while the total remains positive, Return to first page provides recovery.
- Retry preserves the current query. Status 403 explains the permission restriction; a network failure suggests checking the connection. Ordinary server errors do not sign the user out.
- The paginator stays mounted through state changes to preserve keyboard focus. Its pending/error length is zero and it is disabled while loading; this is not a new server total. Result totals are displayed only after success.
- Clear controls focus the persistent search input before removing themselves. Retry and page-recovery buttons focus the persistent results region before switching states.
- Search is trimmed and limited to 100 characters. Filtering remains page-local state: leaving the page resets it, and it is not persisted in the URL or browser storage.
- Browser reload requires login again because authentication is stored in memory. Clicking the dashboard's Reload button only fetches the list and preserves the session/query.
- Responses are typed through shared TypeScript contracts; this is not runtime schema validation of an arbitrary external backend.

## Files and verification

- [`applications.ts`](../src/app/features/applications/applications.ts), template, and SCSS: controls, presentation, responsive layout, and focus handling.
- [`applications.store.ts`](../src/app/features/applications/applications.store.ts): query transitions and request lifecycle.
- [`applications.api.ts`](../src/app/features/applications/applications.api.ts): HTTP boundary.
- [`application-list.ts`](../src/app/features/applications/application-list.ts): view state and status labels.
- Store tests exercise server query parameters, page conversion/reset, debounce, cancellation, retry recovery, clearing, and cleanup.
- Component tests use the real store with Angular's HTTP testing backend; root tests additionally exercise the real providers, login, protected route, bearer request, and logout. Role-aware action tests check New/Edit visibility; the wizard has its own form, autosave, submission, and leave checks.

Executed checks and their results are recorded in [Progress](PROGRESS.md). The [learning log](LEARNING_LOG.md) contains an exercise to trace this flow. Reference: [Angular HTTP requests and cancellation](https://angular.dev/guide/http/making-requests).
