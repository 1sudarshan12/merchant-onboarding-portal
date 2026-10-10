# Mock API contract

Checkpoint 3 implements this contract in Express. The Angular UI will connect to it in later checkpoints. This is a local development server with fictional data, not a production backend. All applications and sessions reset when it restarts.

## Start and configure

Run `npm run dev` from the repository root for both Angular and the API, or `npm run start:api` for just the API. The API binds to `127.0.0.1:3000`. Angular proxies `/api/**` to that address, so frontend requests can use relative `/api/...` URLs. Restart Angular after changing the proxy configuration; see [Angular's proxy documentation](https://angular.dev/tools/cli/serve#proxying-to-a-backend-server).

No environment file is required. Copy `.env.example` to `.env` only to change the demo settings. The server loads this file at startup; existing process environment variables take precedence. `.env` is ignored by Git.

| Setting                    | Default | Accepted values                                                                |
| -------------------------- | ------- | ------------------------------------------------------------------------------ |
| `MOCK_API_PORT`            | `3000`  | Integer 1–65535; also update `proxy.conf.json` if changed.                     |
| `MOCK_ACCESS_TTL_SECONDS`  | `30`    | Integer 1–3600.                                                                |
| `MOCK_REFRESH_TTL_SECONDS` | `3600`  | Integer 1–86400; measured from login, not extended by refresh.                 |
| `MOCK_LATENCY_MS`          | `150`   | Integer 0–5000.                                                                |
| `MOCK_FAIL_LIST_ONCE`      | `0`     | `1` makes the first valid authenticated list request fail with 503.            |
| `MOCK_FAIL_SAVE_ONCE`      | `0`     | `1` makes the first otherwise valid draft PATCH fail with 503 before mutation. |

Fault flags reset on server restart. Invalid configuration stops startup with a descriptive error. These controls support later loading, retry, refresh, and autosave demonstrations.

## Fictional accounts and records

Every demo account uses the password `Demo#1234`. These are public fixture credentials, not secrets or real identities.

| Email                    | User ID      | Role     |
| ------------------------ | ------------ | -------- |
| `sales1@example.test`    | `sales-1`    | SALES    |
| `sales2@example.test`    | `sales-2`    | SALES    |
| `reviewer1@example.test` | `reviewer-1` | REVIEWER |
| `reviewer2@example.test` | `reviewer-2` | REVIEWER |
| `admin@example.test`     | `admin-1`    | ADMIN    |

The store starts with 30 records, `app-001` through `app-030`, spanning all five statuses. Owners alternate between the sales users. Records in review or a terminal status have an assigned reviewer; terminal records contain a decision history entry. Seed versions reflect their stage: 1 for draft, 2 for submitted, 3 for in review, and 4 for terminal records. `app-001` is a complete draft owned by `sales-1`, useful for experimenting with save and submit.

## Authentication

All routes use the `/api` prefix. Protected routes require `Authorization: Bearer <accessToken>`.

| Method and path      | Request body                                                  | Result                                                            |
| -------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `GET /health`        | —                                                             | `{ "status": "ok" }`; public.                                     |
| `POST /auth/login`   | `{ "email": "sales1@example.test", "password": "Demo#1234" }` | `{ accessToken, refreshToken, user }`.                            |
| `POST /auth/refresh` | `{ refreshToken }`                                            | A new `{ accessToken, refreshToken }` pair.                       |
| `POST /auth/logout`  | `{ refreshToken }`                                            | 204; revokes the matching session, idempotent for unknown tokens. |
| `GET /me`            | —                                                             | Current `User`; protected.                                        |

Tokens are opaque random values backed by in-memory sessions. Refresh invalidates both previous tokens immediately. An expired or invalid access token produces 401. The refresh token must still be valid; refreshing does not extend its original expiration. Independent logins have separate sessions. Logout takes the current refresh token and does not require a still-valid access token.

The API supports testing refresh, but the Angular interceptor that shares one refresh across concurrent 401s is **Checkpoint 4**, not implemented here.

## Access and workflow

The scope and reveal rules below are documented design assumptions where the assignment leaves details open. ADMIN does not implicitly inherit the other roles' write actions.

| Role     | Can view               | Can change                                                      | Can reveal stored banking values      |
| -------- | ---------------------- | --------------------------------------------------------------- | ------------------------------------- |
| SALES    | Own applications.      | Create, save, and submit own drafts.                            | No; may replace values in own drafts. |
| REVIEWER | Assigned applications. | Decide assigned applications in review.                         | Assigned applications.                |
| ADMIN    | All applications.      | Assign/reassign a reviewer on submitted/in-review applications. | All applications.                     |

Lifecycle: `DRAFT → SUBMITTED → IN_REVIEW → APPROVED / REJECTED`. Assignment starts review. Submitted records cannot be edited, and terminal records cannot be reopened. Reassignment removes the previous reviewer's access. The API checks role, record scope, and status on each relevant request.

## Application routes

| Method and path                    | Body/query                                      | Result                                                   |
| ---------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| `GET /applications`                | `page`, `pageSize`, optional `status`, `search` | `Page<ApplicationSummary>`.                              |
| `POST /applications`               | `{}`                                            | 201, new empty `ApplicationDetail`, version 1.           |
| `GET /applications/:id`            | —                                               | `ApplicationDetail`.                                     |
| `PATCH /applications/:id`          | `{ version, form: MerchantFormPatch }`          | Updated detail.                                          |
| `POST /applications/:id/submit`    | `{ version }`                                   | Updated detail, status SUBMITTED.                        |
| `PUT /applications/:id/assignment` | `{ version, reviewerId }`                       | Updated detail, status IN_REVIEW.                        |
| `POST /applications/:id/decision`  | `{ version, decision, riskLevel, note }`        | Updated detail with a new history entry.                 |
| `GET /applications/:id/sensitive`  | —                                               | `{ accountNumber, taxId }`, only with reveal permission. |
| `GET /reviewers`                   | —                                               | `User[]` of reviewers, ADMIN only.                       |

List pages are **1-based**, default 1. Page size defaults to 10 and has a maximum of 50. The server applies role scope, exact status, and trimmed case-insensitive legal-name search before calculating `total` and paginating. Search is at most 100 characters. Results sort by `updatedAt` descending, then ID ascending. An out-of-range page returns an empty `items` array and the filtered total. The future Material paginator uses 0-based indices and must convert at the API boundary.

Every existing-record mutation requires the version last read by the client. A successful mutation increments the version and updates `updatedAt`. A stale version returns 409 without changing data. Version checking and mutation are synchronous within this single-process mock. A production database would need an atomic conditional update/transaction.

Decision is `APPROVE` or `REJECT`; risk level is `LOW`, `MEDIUM`, or `HIGH`. The note is a required string, at most 2000 characters; it may be empty for approval, but rejection requires a nonblank explanation. Actor identity and timestamps come from the server. History cannot be supplied or rewritten through a draft patch.

## Draft values and validation

The exact TypeScript definitions live in `shared/models.ts`. The internal form has four sections:

- `business`: legal name, optional trading name, registration number, business type, industry, optional website.
- `contact`: full name, email, phone, address, city, postal code.
- `banking`: bank name, account number, tax ID.
- `processing`: monthly volume, average ticket, maximum ticket, international-payment flag.

Account numbers and tax IDs are strings to preserve leading zeros. These field formats are demo assumptions, not country-specific banking rules.

Draft patches can be incomplete. Only known sections and fields are accepted. Strings are trimmed and limited to 500 characters; processing amounts must be finite numbers between 0 and 1 trillion; the international flag must be boolean. Empty strings can clear a saved value. Unknown fields, wrong types, and sensitive values containing masking characters are rejected with 400.

Submission validates the entire saved form: legal name at least two characters; registration 6–20 letters/digits/hyphens; selected business type and industry; required contact/address fields; email format; phone 7–15 digits with optional spaces and leading `+`; bank name; account number 8–17 digits; tax ID nine digits. All processing amounts must be positive, with `averageTicket ≤ maxTicket ≤ monthlyVolume`. An optional website must be HTTP(S). Invalid submissions return 422 with dotted field paths for future form error mapping.

For example, this changes one field without touching the rest:

```json
{
  "version": 1,
  "form": {
    "business": { "legalName": "Example Merchant Updated" }
  }
}
```

## Masking and restoration

Default detail and mutation responses omit `form.banking.accountNumber` and `form.banking.taxId`. Instead, they return separate display metadata:

```json
{
  "sensitive": {
    "accountNumber": { "present": true, "masked": "•••• 0001" },
    "taxId": { "present": true, "masked": "•••• 0001" }
  }
}
```

An unset value has `present: false` and `masked: ""`. Stored values of four characters or fewer are completely masked, since incomplete drafts are allowed. List responses contain summary fields only. All responses use `Cache-Control: no-store`.

The future form must keep this display metadata separate from editable input values. Omit unchanged sensitive fields from a patch; send raw replacement values only when the user changes them. A mask is never a value to restore into a form control and save. The server validates actual stored values at submission, so restoring a draft does not require SALES to reveal those values.

## Errors

Errors share this shape:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Complete the required application details.",
  "fields": { "banking.taxId": "Use 9 digits for the tax ID." }
}
```

| Status | Meaning                                                                  |
| ------ | ------------------------------------------------------------------------ |
| 400    | Malformed JSON, unsupported fields/query, invalid type/version/assignee. |
| 401    | Invalid login, access token, or refresh token.                           |
| 403    | Wrong role or outside the user's record scope.                           |
| 404    | Unknown record or API route.                                             |
| 409    | `VERSION_CONFLICT` or `INVALID_STATE`; no write applied.                 |
| 413    | JSON body exceeds 32 kB.                                                 |
| 422    | Submission or decision validation; optional field errors.                |
| 503    | Configured one-time failure; retry is possible.                          |
| 500    | Generic unexpected server failure; stack/internal data omitted.          |

Tests in `mock-api/app.spec.ts` exercise this contract over HTTP; `shared/permissions.spec.ts` checks the reusable permission predicates. See [security notes](SECURITY.md) for the limits of this demo.
