# Application detail and review: checkpoint 7

The detail route is shared by the three roles, but actions are derived from the current user and record state. The API repeats those checks on every request.

## Responsibilities

- `application-detail.ts`: loads a detail record, chooses role-aware actions, and coordinates assignment, decision, and reveal requests.
- `application-detail.api.ts`: keeps HTTP paths and versioned request bodies typed at the feature boundary.
- `application-detail.html` and `.scss`: present public details, masked banking metadata, review history, and responsive action panels.

The dashboard links merchant names to `/applications/:id`. The existing draft edit link remains a separate SALES-only action. A submitted or terminal record cannot be opened in the wizard.

## Permission model

ADMIN can assign or reassign a reviewer while a record is SUBMITTED or IN_REVIEW. Assignment moves the record to IN_REVIEW. Only the assigned REVIEWER can decide an IN_REVIEW record. Decisions are APPROVE or REJECT with LOW, MEDIUM, or HIGH risk; rejection requires a nonblank note. Terminal records show their history and have no action form.

Reveal is deliberately an explicit action. The page starts with masks from the ordinary detail response. ADMIN or the assigned REVIEWER can call the separate reveal endpoint. The returned values are held in a signal for the current component instance and can be hidden; they are not persisted or included in links. SALES never receives a reveal control.

Version numbers are sent with assignment and decision requests. A stale version is reported as a conflict rather than silently overwriting another user's change. The current UI asks the user to reload, which is safer than guessing how to merge an assignment or decision.

## Learning exercises

1. Open the app as REVIEWER and compare an assigned `IN_REVIEW` record with an assigned terminal record. Which controls disappear, and why?
2. Open an ADMIN session, assign a submitted record, then sign in as that reviewer. Observe the lifecycle change and the new decision form.
3. Inspect the network response before and after reveal. Explain why the default detail response is safer to cache and why the reveal response uses no-store headers.
4. Add a focused conflict test for two admin tabs assigning different reviewers with the same version. The server should accept one and return 409 for the stale request.
