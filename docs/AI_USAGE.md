# AI assistance disclosure

This record describes assistance received, not an assertion that the candidate has already reviewed or understood every result. Update it as the project progresses.

## Tool and scope

OpenAI Codex assisted with:

- Reviewing the supplied assignment and implementation plans, and distinguishing requirements from suggested scope.
- Identifying disagreements in role permissions and API contracts, and risks in the proposed autosave, masked draft restoration, and refresh designs.
- Developing the initial architecture choices and a step-by-step learning approach.
- Generating the Angular CLI scaffold; implementing the initial component, Material theme, and TestBed smoke test; and maintaining setup, architecture, learning, and progress documentation.

The initial implementation choices include Angular 21, Angular Material with SCSS, standalone components, strict TypeScript, and Vitest with Angular TestBed. Feature contracts and implementation will be documented as they are settled.

## Verification record

| Check                                       | Recorded result                                                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation build                            | Passed: `npm run build` on 9 October 2026; no warnings.                                                                                   |
| Vitest / TestBed test                       | Passed: `npm run test:ci`, one component rendering test.                                                                                  |
| Browser inspection                          | Codex inspected desktop and 375px layouts, checked horizontal overflow and console warnings/errors, and exercised the keyboard skip link. |
| Candidate code review and explanation       | Not yet recorded.                                                                                                                         |
| Business workflows and authorization checks | Not implemented at this checkpoint.                                                                                                       |

Record actual commands, outcomes, and corrections when checks are run. Do not claim manual review, independent authorship of AI-assisted decisions, or successful tests without evidence.

## Ownership and confidentiality

The candidate remains responsible for the submitted code, final design decisions, verification, and interview explanation. Keep the assignment and solution private according to the assignment terms. This disclosure summarizes assistance without reproducing the private assignment or the plans' embedded prompts.

## Checkpoint 2 assistance

Codex implemented the responsive shell, lazy workspace route, SCSS design tokens, Material checklist dialog, decorative icons and SVG illustration, and route/dialog integration tests. It updated the README, design guide, architecture notes, and learning log. A Codex subagent helped with the checklist, icon component, design guide, and a bounded code review.

Verification included desktop and phone browser inspection, overflow checks, keyboard focus containment, Escape dismissal, focus restoration through the drawer and dialog, the skip link, and console inspection. The first test run exposed an animation-timing issue in the assertion; the test now waits for `afterClosed()`. The first build exposed a component stylesheet budget warning; the decorative illustration was moved into a local SVG. Review identified low contrast on the small stage numbers, which was corrected.

Final build and test results are recorded in [the progress log](PROGRESS.md). Candidate code review, explanation, and learner exercises remain unrecorded.

## Checkpoint 3 assistance

Codex implemented the shared domain/API contracts, permission helpers, fictional seed data, runtime validation, mock HTTP server, opaque token sessions, safe response mapping, workflow endpoints, and API/permission tests. Subagents worked on bounded server, validation/seed, and test tasks. Codex also configured local startup, the Angular development proxy, API type checking, and optional fault controls, and maintained README, API, architecture, learning, progress, and security documentation.

Verification on 10 October 2026: 25 API/permission tests and two Angular TestBed tests passed, strict API type checking passed, and the production build passed without warnings. A live check through Angular's proxy verified health, login, scoped pagination, logout, and revoked-token rejection. Local network access required sandbox approval. The existing Angular process occupied port 4200, so the live check used a temporary server on 4201. A startup check found and corrected a misleading success log on a listen failure.

The API tests do not demonstrate client-side concurrent refresh, forms, autosave, or role-aware pages; those are later checkpoints. Candidate review, explanation, and learner exercises remain unrecorded.

## Checkpoints 4 and 5 assistance

Codex assisted with the frontend authentication implementation described in [Authentication](AUTHENTICATION.md), then implemented the application dashboard: typed API access, component-scoped query/result signals, cancellable RxJS reads, server pagination, debounced search, status filtering, responsive presentation, and recovery states.

At the start of Checkpoint 5, auth files were present while the root still used its earlier configuration. Codex reconnected the router, `HttpClient` interceptor, and authenticated shell and added integration tests using the real application providers. Subagents handled bounded root integration, dashboard UI, focused test, documentation, and review tasks. The root agent coordinated changes, implemented the data layer, and verified the integrated result.

Review identified a keyboard regression: conditional result rendering destroyed the paginator during loading. The paginator now remains mounted; clear actions and retry move focus to persistent elements. Tests render the intermediate pending state to catch this class of problem instead of only checking the completed response.

Verification: 47 Angular tests passed, and the production build passed without warnings or budget changes. Browser checks exercised scoped Sales pages, status filtering, page-size changes, filtered empty recovery, phone layout, pagination/clear/retry focus, and a simulated 503 followed by retry after access-token expiry. Full results and any additional role checks are recorded in [Progress](PROGRESS.md). No API contract or mock-server code changed in this checkpoint.

Codex maintained implementation notes and learner exercises. Candidate review, understanding, authorship explanation, and exercise completion are not implied by passing tests and remain unrecorded. No commit, publication, reviewer invitation, or external communication was performed for this checkpoint.

## Checkpoint 6 assistance

Codex implemented the 19-field typed merchant form and five-step wizard, explicit draft creation, masked restoration, versioned autosave, final-save-before-submit, own-SALES-draft links, role-guarded root routes, and navigation/sign-out safeguards. Subagents handled bounded form, field UI, tests, documentation, and review tasks. The root agent coordinated autosave and application integration and performed the browser verification.

Autosave keeps one PATCH in flight, coalesces later edits into the latest pending snapshot, and debounces ordinary edits for 700 ms. The implementation preserves values after save failures, supports explicit retry, and pauses on a version conflict until the user chooses whether to discard local edits and reload. Mask metadata never becomes an editable banking value. The implementation does not promise that cancelling a request reverses a server write or that unsaved values survive browser reload.

Verification recorded for this checkpoint: 78 Angular tests passed across nine files, and the production build passed without warnings, with a 303.12 kB initial bundle and 74.89 kB lazy wizard chunk. Budgets, API contracts, and mock-server code were unchanged. The earlier 25 API tests were not rerun and remain a historical result. Repository-wide formatting and Git whitespace checks passed.

Live checks restored seeded `app-001`, exercised an injected save 503 without losing inputs, used Stay here and Retry saving after expiry of a temporary three-second access token, restored the saved name, and verified stored banking masks beside blank replacement inputs. The restored draft reached review and submission; confirmation focus and removal of its dashboard Edit draft action were checked. A separate new draft completed all five steps: incomplete Business values saved while required errors blocked Continue, and a processing average greater than the maximum produced a visible cross-field error. After correction, the review masked banking values. Changing monthly volume from 10000 to 12000 and submitting before debounce showed the pending submission state, then successful confirmation with heading focus. The inspected 375px wizard and 1440px desktop review had no horizontal overflow; final captured browser warning/error logs were empty. Conflict behavior was verified in TestBed, not through a live browser conflict. The API was then restarted with normal settings, resetting fictional records, and the preview was signed out for the learner.

Verification identified and corrected OnPush touched-field error rendering, preservation of server validators across step mounts, retention of server errors until changes in their own section, and incorrect saved-state reporting for values outside draft wire bounds. Detailed implementation and learning notes are maintained in [Wizard](WIZARD.md), [Progress](PROGRESS.md), and the learning log.

Before implementation, the branch `feat/application-wizard` was fast-forwarded to the user's existing checkpoint 5 commit `16bca90`, which it initially lacked. No new commit, push, publication, invitation, or external communication was performed. Candidate independent review, understanding, explanation, and exercise completion remain unrecorded.

## Checkpoint 7 assistance

Codex implemented the lazy application detail page, role-aware assignment and decision forms, risk history, masked sensitive-field presentation, explicit reviewer/admin reveal, dashboard detail links, and focused TestBed coverage. Verification found and corrected an event-handler lifecycle mistake: `takeUntilDestroyed()` now receives the component `DestroyRef` when called outside the constructor injection context.

Verification: 80 Angular tests passed across 10 files and the production build passed after the detail chunk was added. Live Reviewer checks covered scoped assigned applications, masked-to-revealed banking values, and rejection-note validation. Live Admin checks assigned Demo Reviewer 02 to submitted `app-027`, moving it to IN_REVIEW. The API contract and earlier 25 API tests were unchanged. Candidate explanation and exercises remain to be completed.
