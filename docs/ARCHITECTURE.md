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

## Proposed roles and workflow

These are conservative implementation assumptions, not extra requirements from the assignment. Keep one permission contract for the UI and mock API; the supplied plans disagree about ADMIN permissions.

| Actor    | Proposed permitted actions                                                                          |
| -------- | --------------------------------------------------------------------------------------------------- |
| SALES    | View own applications; create and edit own drafts; submit them.                                     |
| REVIEWER | View assigned applications; record an approval or rejection when review is allowed.                 |
| ADMIN    | View all applications and assign reviewers. Creation and risk decisions are not granted by default. |

Proposed lifecycle: `DRAFT → SUBMITTED → IN_REVIEW → APPROVED / REJECTED`. Submission belongs to the owner, assignment starts review, and only the assigned reviewer records the decision. Reopening or editing a submitted application is outside the initial scope.

The exact application scope, sensitive-field reveal permissions, form fields, endpoint names, and transition rules must be recorded before feature implementation. Proposed reveal policy: assigned REVIEWER and ADMIN can request a reveal; SALES can supply or replace sensitive draft values without receiving stored raw values back.

Route guards and hidden controls guide navigation. The mock API must independently enforce role, ownership, assignment, and status checks. Editing the DOM or calling an endpoint directly must not bypass them.

## Design constraints for later checkpoints

- **Autosave:** Debounce edits, but mark them unsaved immediately. Cancelling an HTTP subscription cannot undo a server write. Serialize writes, retain the latest pending snapshot, and handle version conflicts without discarding the form. Flush and await the final save before submission. Catch errors inside the ongoing save flow so subsequent edits can still save.
- **Masked draft restoration:** Keep masked display values separate from form input values. Return stored-value presence metadata; accept either an existing sensitive value or a valid replacement. Omit unchanged sensitive fields from patches. Never save a string of masking characters as the real value.
- **Authentication refresh:** Attach bearer tokens only to the trusted API. Share one refresh request between concurrent 401 responses and retry each failed request at most once. A late 401 can use an already replaced token. Clear shared refresh state at the source lifecycle, and distinguish refresh failures from errors returned by the retried application request.
- **Sensitive data:** Use synthetic data only. Keep raw values out of URLs, logs, browser persistence, and default detail responses. Role checks belong on the reveal endpoint as well as in the UI.
- **CSP:** Explain it as defense in depth. A production policy must protect the served HTML document; setting a header only on JSON API responses does not protect the Angular page. CSP does not replace authorization or safe rendering.

These are design notes, not implemented guarantees. Tests and direct API checks will provide evidence as the corresponding features are built.

## Scope boundary

Prioritize the required dashboard, application wizard, draft saving, review detail, permissions, refresh flow, and meaningful tests. Dashboard counts and real-time updates remain optional. The original expectation is six to eight hours of implementation effort; learning time and actual effort will be recorded separately where useful. The plans' stated 12 October deadline has not been independently confirmed.

## Foundation verification

Checked on 9 October 2026 with Node 24.14.0 and npm 11.9.0. Installed versions are locked in `package-lock.json`: Angular core 21.2.25, CLI 21.2.26, Material 21.2.14, and Vitest 4.1.11. The production build passed without warnings, and the TestBed rendering smoke test passed. Desktop and 375px browser checks verified readable layout, no horizontal overflow, and keyboard access to the main content. Full workflow and accessibility checks remain future work.

References: [Angular version compatibility](https://angular.dev/reference/versions), [Angular testing](https://angular.dev/guide/testing), and [Material theming](https://material.angular.dev/guide/theming).
