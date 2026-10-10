# Merchant wizard and autosave: checkpoint 6

SALES can create applications and edit its own drafts. The dashboard offers **New application** and **Edit draft** only where permitted. `/applications/new` describes the workflow; its **Create draft** button explicitly creates a record and opens `/applications/:id/edit`. Merely visiting the new route does not create records.

The wizard contains Business, Contact, Banking, Processing, and Review steps. Required fields and cross-field relationships gate forward navigation and submission. Draft saving deliberately permits incomplete information. The API independently enforces authentication, ownership, status, version, and submission validation.

## Responsibilities

- `application-wizard.ts`: route/load/create orchestration, steps, submission, and navigation safeguards.
- `merchant-form.ts`: concrete typed nested form groups, custom validators, restoration, and safe draft snapshots.
- `merchant-fields.ts`: Material fields, labels, hints, and validation feedback for the four data sections.
- `draft-autosave.ts`: a component-scoped coordinator for debounce, ordered writes, acknowledged versions, failure recovery, and final submission.
- `draft.api.ts`: create/get/save/submit HTTP calls using shared contracts and the existing authentication interceptor.
- `draft-exit-dialog.ts` and `PendingChanges`: explicit stay/save/discard choices, including sign-out.

All these feature files live in `src/app/features/application-wizard/`, except `PendingChanges` in `src/app/core/auth/`. The feature loads lazily and adds no dependency.

## Typed forms and validation

Each section is a typed `FormGroup`; business types and flags retain their enum/boolean types. Number inputs use `number | null` because clearing the input produces no number. The snapshot maps an empty amount to zero, which the API accepts for an incomplete draft; submission requires positive amounts.

Custom validators match the documented demo contract: trimmed required values, registration format, optional HTTP(S) website, email, phone, banking digit formats, finite amount bounds, and `averageTicket ≤ maxTicket ≤ monthlyVolume`. These banking formats are assignment assumptions, not country-specific validation.

Draft saveability checks only wire-format bounds (for example, finite non-negative amounts, maximum text length, and no masking characters). A blank required name or incomplete email can still be saved. Values that cannot be sent safely stay in the form with an explanation; the interface does not label them saved.

Field validation also accepts server errors identified by dotted paths. These errors participate in the control validators so mounting a step cannot erase them; they clear when their section changes. A rejected submission returns to the relevant section. `MerchantFields` observes form events so parent-triggered touched/error changes render under `OnPush` even when the same form instance remains attached.

## Restoring sensitive values

Restoration copies public fields and keeps account/tax input controls blank and pristine. Existing masked values appear as separate hints, never as control values. The form accepts a pristine blank sensitive input when the server reports an existing value.

Editing a sensitive input expresses replacement intent. Its raw replacement is sent; editing and then clearing it sends an explicit empty string. Leaving an existing value untouched omits it from the payload. Leading zeros remain intact because these fields are strings.

Presence means a value exists, not that it is valid. The server checks its actual stored value at submission; a previously saved incomplete number can produce a field error requiring replacement. Review summaries show masks, including masks for new replacements. User-entered replacements remain only in memory while editing and are cleared from the form/coordinator after successful submission.

## Why autosave does not use switchMap for writes

The dashboard can cancel obsolete reads. A draft save may already have committed by the time its subscription is cancelled. Cancelling saves for every new keystroke could therefore create unknown versions and reorder writes.

This coordinator uses an RxJS `Subject` with a **700 ms debounce**, a single in-flight request, and one latest pending snapshot:

1. An edit immediately becomes unsaved; waiting for debounce never implies it is already saved.
2. When due, send the current snapshot with the last acknowledged server version.
3. Continue accepting edits locally during the request. Coalesce them into one latest snapshot instead of queuing every keystroke.
4. On success, update the server version and acknowledged snapshot. Never reset or patch the live form from this response, because it may already contain newer edits.
5. If newer changes are due, send them with the returned version. Otherwise respect their remaining debounce.

**Save draft** flushes the debounce. Its promise succeeds only after the latest snapshot is acknowledged. Submission disables editing, flushes/awaits saving, then sends one submit request with that acknowledged version. Double submission is blocked.

## Failures and conflicts

A failed save keeps the latest local snapshot and the visible form. Retry uses the last acknowledged version. A later edit can also resume the save stream. No automatic HTTP write retry is layered over the authentication interceptor's bounded refresh retry.

A lost response does not prove the server rejected the save. The coordinator remembers an unconfirmed write, so even undoing to the old baseline requires reconciliation. If the earlier write committed, the version check returns 409 and prevents an accidental overwrite.

On 409, saving pauses and local edits remain visible. **Load server copy** requires an explicit discard confirmation. Staying keeps the local form. This checkpoint provides deliberate discard/reload, not automatic merging. A successful fresh load establishes a new baseline and version.

Requests have bounded timeouts. An interrupted create or submit may have reached the server; messages explain that the user should check the list/server state before retrying. Cancelling a subscription on component destruction prevents further local callbacks; it cannot roll back an accepted server write.

## Leaving and session limits

Route navigation and explicit sign-out consult the same unsaved-change check. The dialog offers Stay here, Leave without saving, and—when possible—Save and leave. A failed save keeps navigation blocked. Reloading after a conflict is a separate explicit discard decision. While submission is in progress, navigation waits for the outcome rather than interrupting the workflow.

A `beforeunload` handler requests the browser's native warning for pending edits; browsers control whether and how that warning appears. It does not attempt an unreliable unload-time HTTP save.

Sessions and unsaved edits are memory-only. Reloading requires login; only acknowledged server data can be restored. Session expiry that cannot be refreshed returns to login and does not persist raw banking input in browser storage. No offline draft persistence or automatic conflict merge is claimed. The mock API also resets all records when restarted.

## Learning and verification

Read the autosave tests in order: debounce, serialization, failure/retry, conflict, uncertain response, and submission. Component tests exercise restoration and visible form interactions. Root integration tests use actual route guards and HTTP providers. Executed results and browser checks are recorded in [Progress](PROGRESS.md).

References: [Angular typed forms](https://angular.dev/guide/forms/typed-forms), [form validation](https://angular.dev/guide/forms/form-validation), and [route guards](https://angular.dev/guide/routing/route-guards).
