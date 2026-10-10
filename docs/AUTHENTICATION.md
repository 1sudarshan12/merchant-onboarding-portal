# Authentication: checkpoints 4 and 5

Checkpoint 4 implements login, logout, route protection, session state, and refresh coordination. The application now registers that wiring at the root, and checkpoint 5 uses it for protected dashboard list requests. The overview remains informational; `/applications` fetches live mock data and can trigger refresh when its access token expires. See [dashboard behavior](DASHBOARD.md).

## Responsibilities

- [`AuthService`](../src/app/core/auth/auth.service.ts) owns the in-memory session and exposes read-only `user` and `isAuthenticated` signals. Components do not manage tokens.
- [`authInterceptor`](../src/app/core/auth/auth.interceptor.ts) attaches credentials and handles an expired access token around protected HTTP requests.
- [`auth.guard.ts`](../src/app/core/auth/auth.guard.ts) protects navigation. The mock API independently checks authentication and record permissions.
- [`Login`](../src/app/features/auth/login.ts) owns the typed sign-in form and its loading, validation, and error states.
- [`WorkspaceShell`](../src/app/layout/workspace-shell.ts) owns authenticated navigation, the current identity, the route breadcrumb, and the Sign out action. `App` only hosts the router outlet.
- [`app.config.ts`](../src/app/app.config.ts) registers the real routes and `provideHttpClient(withInterceptors([authInterceptor]))`. The root integration tests use these providers rather than an authentication stub.

Signals answer “who is signed in now?” RxJS describes asynchronous work: login, refresh, retries, timeouts, and errors. Keeping those responsibilities distinct makes each easier to follow.

## A protected request

1. Login sends credentials to `/api/auth/login`. A successful response stores the user and tokens in memory and opens the permitted return destination.
2. A protected API request receives the current bearer token. Successful requests and ordinary application errors pass through normally.
3. An initial `401` triggers refresh if the request still belongs to the current authenticated session.
4. A successful refresh replaces both tokens, then retries the original request once with the new access token.
5. If refresh fails, the current session is cleared and navigation returns to login with an expired-session message. A second `401` from the retried request also expires the matching current session.

The interceptor accepts only normalized, root-relative `/api/` URLs. It excludes authentication routes and health checks. Absolute URLs and requests outside that API boundary do not receive the application's token. This also prevents login or refresh failures from starting another refresh.

The mock access token lasts 30 seconds by default. Expiration is discovered by a protected request, not an idle timer. Leaving the overview open for 30 seconds therefore does not itself start refresh or sign the user out.

## One refresh for concurrent requests

Several requests can fail with `401` at nearly the same time. `AuthService` keeps one `refreshRequest` Observable and shares its HTTP execution with `shareReplay({ bufferSize: 1, refCount: false })`. All waiting requests receive the same replacement token. The source has a 10-second timeout.

`finalize` sits **before** `shareReplay`. It clears the shared reference when the HTTP source finishes, rather than when an individual waiting request unsubscribes. It also checks that the reference still belongs to that request, so an old completion cannot clear a newer refresh.

A late `401` may arrive after another request has already completed refresh. The interceptor compares the failed request's token with the current token. If they differ, it retries with the current token without rotating credentials again.

The retry has its own error handling. A retried `403`, `409`, `422`, or server error remains an application error; it does not become a refresh failure or clear the session. The retry cannot recursively enter the original refresh handler.

## Logout and responses that arrive late

A session revision changes on login attempts and session clearing, but not on token rotation. Asynchronous responses carry the revision they started with. A response from an older session cannot restore its user, expire a newer login, or replay its request with the new user's credentials.

Logout clears local access immediately and navigates to login. The shell first closes dialogs and mobile navigation. Server revocation is a separate best-effort request with a five-second timeout; failure does not undo local logout. If an old login or refresh later returns tokens, the service attempts to revoke those tokens without restoring that session.

Tokens are not written to `localStorage`, `sessionStorage`, or URLs. Reloading the browser requires another login. This is an explicit demo tradeoff, not persistent-session support. See [security notes](SECURITY.md) for the mock's limits.

## Navigation and roles

`authGuard` protects the lazy workspace parent; `authChildGuard` checks child navigation. `guestGuard` keeps an already signed-in user out of the login screen. Both overview and Applications are available to every authenticated role. The API scopes the records each role receives. The root defaults to overview after sign-in; Applications is available from the sidebar or a protected deep link.

`permissionGuard(permission)` is ready for future restricted features using the shared role permissions. It does not replace ownership, reviewer assignment, status, or version checks at the API. The Applications route requires authentication; its record scope is enforced by the API. The wizard and review routes remain future work.

[`safeReturnUrl`](../src/app/core/auth/auth-navigation.ts) currently permits the normalized `/overview` and `/applications` paths, preserving the accepted path's query and fragment. The dashboard does not yet synchronize its filters with those query parameters. External, unknown, malformed, and login destinations fall back to `/overview`. Extend this allowlist when real feature routes are introduced.

## Verification and learning

The written HTTP tests cover concurrent and late `401` responses, subsequent refresh cycles, refresh failure, one retry, business-error separation, logout during refresh, and old responses after a new login. Guard tests cover anonymous access, role permission checks, guest navigation, and safe return destinations. Component tests cover the login form, authenticated shell, and dashboard. Root integration tests use the actual application providers and real authentication service to check form login, the guarded dashboard request with a bearer header, active navigation, and logout removing private content. Test outcomes are recorded in [the progress log](PROGRESS.md) after execution.

Run `npm run test:ci` for Angular tests. To understand the key distinction, read the test where refresh succeeds but the retried request returns `500`: credentials are valid, while the requested operation failed. Signing the user out would hide that real problem.
