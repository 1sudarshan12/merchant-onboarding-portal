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
