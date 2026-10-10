# Security notes

## Implemented in Checkpoint 3

The mock API authenticates protected requests and enforces role, ownership, assignment, and workflow state on the server. List scope is applied before filtering, pagination, and totals. Draft patches use nested field allowlists, so client-supplied owner, status, role, and history fields cannot change internal records. Runtime validation complements TypeScript, whose types do not validate incoming JSON.

Access and refresh tokens are random opaque values. Refresh rotates both tokens, invalidating the previous pair. Access tokens expire after 30 seconds by default; refresh expiration is fixed from login. Logout revokes the session matching the supplied current refresh token. Tokens are not logged by the application.

Ordinary application responses explicitly construct public fields and masked banking metadata. The reveal endpoint returns stored account/tax values only to ADMIN or the assigned REVIEWER. SALES can replace sensitive values in its own drafts but cannot read stored raw values. All API responses use `Cache-Control: no-store`; request bodies are limited to 32 kB and errors omit stack traces and submitted values.

The server binds to loopback and has no cross-origin permission headers. Angular's development proxy supplies same-origin `/api` access. The demo stores only fictional identities and banking values.

## Limits of this mock

This server exists to demonstrate frontend behavior. It uses published demo credentials, keeps unencrypted data and sessions in process memory, and resets on restart. It has no persistent audit store, production identity provider, password hashing, login rate limiting, or deployment setup. Do not use it with real merchant information or expose it as a production service.

Optimistic versions prevent stale writes within the single server process. A real backend needs atomic database updates and durable storage. Banking validation is intentionally simplified and is not a statement of jurisdiction-specific financial requirements.

The API returns 403 for an existing record outside the user's scope and 404 for an unknown record. This intentionally distinguishes those conditions in the demo. A production policy may choose uniform 404 responses to reduce record-existence disclosure.

## Planned frontend protections

Checkpoint 4 will add in-memory frontend session state, a bearer interceptor restricted to the trusted API, coordinated refresh for concurrent 401 responses, and route guards. Later checkpoints will add permission-aware controls and temporary sensitive-field reveal. None of these frontend protections are claimed implemented by the mock API tests.

Avoid placing tokens or raw sensitive values in URLs, logs, or browser persistence. Rendering should use Angular's normal escaped bindings, without bypassing sanitization. A production authentication design should choose its cookie/token storage strategy alongside the backend, including CSRF protections when cookie credentials are used.

The assignment's CSP requirement remains future deployment work. A CSP must be delivered with the Angular HTML document and verified against the actual built application. A header on JSON responses alone does not protect that document. CSP is an additional browser defense and does not replace server authorization.

## Verification

The HTTP tests cover login/expiry/rotation/logout, role and record scope, default masking and reveal restrictions, field allowlists, version conflicts, workflow transitions, and unchanged data after an injected failed save. The tests are evidence for these bounded behaviors, not a penetration test or a claim that production security is complete.
