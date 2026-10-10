# Design guide

The portal should help users find an application, understand its state, and complete the next permitted action. Visual polish should support those tasks: clear hierarchy, readable forms, predictable controls, and useful feedback.

## Current scope through checkpoint 6

Checkpoint 2 established the responsive shell, lazy workspace overview, and Material preparation-checklist dialog. Checkpoint 4 adds the sign-in form, real authenticated identity, protected shell, and sign out. Checkpoint 5 adds `/applications`: a server-backed list with search, status filtering, pagination, and useful result states. Checkpoint 6 adds New application and own-draft editing for SALES, with a five-step form and submission.

The default authenticated destination remains `/overview`, and Applications has its own navigation link. The shell's breadcrumb follows the route. The overview and checklist explain the workflow; they do not create records. The list now offers real New application and Edit draft actions where permitted. General application detail and administrator/reviewer screens remain future work; merchant names are not placeholder links.

Do not display an invented signed-in role, fabricated counts, or buttons that suggest unavailable actions work. Add feature navigation and actions when their destinations and behavior exist.

## Styling approach

Use Angular Material with SCSS. This fits the assignment's stated styling options and gives us consistent interactive components. SCSS organizes our application styles; Material handles its component styling and behavior. Accessibility still requires suitable content, labels, contrast, keyboard checks, and correct integration.

The visual direction is restrained navy and teal: navy for structure and primary text, teal for emphasis, light neutral backgrounds for breathing room. Use color sparingly and never as the only way to communicate status or an error.

### Semantic tokens

A token is a named design value. Name tokens by their purpose so components do not depend on a particular shade.

| Purpose | Used for                                                    |
| ------- | ----------------------------------------------------------- |
| Canvas  | Background behind the page and its panels.                  |
| Surface | Cards, navigation panels, and dialog surfaces.              |
| Ink     | Headings and primary content.                               |
| Muted   | Secondary explanations that still need readable contrast.   |
| Accent  | Primary actions, selected navigation, and focused emphasis. |
| Border  | Subtle separation between controls and surfaces.            |

Define these CSS custom properties under `:root` in `src/styles/_tokens.scss`, load them through the global stylesheet, and reuse them in component SCSS. Keep Material theme values consistent with the application palette; avoid reaching into Material's internal DOM to restyle controls.

The actual accent token in `src/styles/_tokens.scss`:

```scss
:root {
  --color-accent: #176b62;
}

.section-label {
  color: var(--color-accent);
}
```

CSS custom properties such as `--color-accent` remain available in the browser. SCSS variables are resolved when styles are compiled. They can coexist; the named CSS token lets multiple components share a value.

### Spacing and typography

Use a small spacing scale based on 4px: 4, 8, 12, 16, 24, 32, and 48px. Close gaps group related content; larger gaps distinguish sections. Use responsive page padding rather than oversized empty space around a heading.

Keep the type hierarchy small: one page heading, section headings, readable body text, and restrained supporting labels. Start with 16px body text and comfortable line height; keep secondary text readable. Use system fonts to avoid a required external font request. These are design rules, not a requirement to use every size on every page.

## Layout and component responsibilities

- **Shell:** `WorkspaceShell` is the authenticated application frame: navigation, brand, skip link, and the outlet for route content. A sidebar can remain visible on wide screens and become compact or collapsible on narrow screens. If collapsed, its toggle must work with the keyboard, expose its expanded state, and preserve sensible focus behavior.
- **Route page:** The content for a particular URL, including its page heading and the actions relevant to that task. The overview introduces the workflow; Applications provides the working list; the wizard focuses on one merchant form section at a time.
- **Reusable UI:** A component with a clear repeated purpose, such as a status indicator or an error panel. Extract one when actual reuse warrants it. A checklist dialog is a focused interaction and does not need its own route.

The dashboard places search and status filters above a table on wide screens and merchant cards on narrow screens. Both presentations show the same returned page: merchant name/ID, status, creator, reviewer, and update date. Text labels accompany status colors. Totals are actual filtered server totals, not fabricated metrics.

Loading replaces old results with an announced loading state. Errors provide a Try again action. Empty states distinguish no accessible applications, no filter matches, and a page that has become empty; the last offers a return to the first page. Reload keeps the current query. Material's paginator offers 10, 25, or 50 rows per page. See [dashboard behavior](DASHBOARD.md) for state and request details.

## Wizard interaction

The steps are Business, Contact, Banking, Processing, and Review. A new route first asks the user to Create draft, making the server mutation explicit. Existing own drafts open their saved values directly. Forward navigation validates earlier sections; Back preserves edits. The final summary offers section editing and masks account/tax values.

Save feedback distinguishes unsaved, saving, saved, failure, and conflict. Incomplete drafts may save, while submission has stricter validation. Failed saves preserve inputs and expose Retry saving. A conflict pauses saving and offers Load server copy only through an explicit discard confirmation. Do not imply that closing a page cancels a server write.

Stored account/tax values are shown as masked metadata beside blank replacement inputs. Empty pristine inputs retain their saved values; an edited blank means the user intends to clear them. This makes restoration possible without revealing raw stored values to SALES.

Pending changes on navigation or explicit sign out offer Stay, Save and leave when possible, or Leave without saving. The dialog explains that a write already sent may still finish. During submission the form and step actions are disabled. Field errors and step notices provide text feedback; the active step heading receives focus when the step changes. Verification outcomes are recorded separately in [Progress](PROGRESS.md). See [the wizard guide](WIZARD.md) for state and persistence details.

## Accessibility rules and checks

- Use navigation and main-content landmarks, a meaningful page heading, and a skip link that moves focus to the main content.
- Keep focus visible. Give interactive elements accessible names and use actual buttons or links for their intended behavior.
- The checklist dialog needs an accessible name, keyboard focus containment, a clear close action, and focus returned to its opener. Verify those behaviors; do not assume a component library removes the need to check them.
- Preserve a logical reading order when columns collapse. Prevent horizontal overflow and ensure controls remain usable at narrow widths.
- Respect `prefers-reduced-motion` when adding transitions or animation. Motion is optional; it must not be necessary to understand a state change.
- Test keyboard operation, text readability, and browser zoom before claiming accessibility is complete.

## Learning exercise

After checkpoint validation, find the actual accent token in `src/styles/_tokens.scss`. Change it, observe which parts of the page share it, and restore it. Explain why a shared token is easier to maintain than repeating the same hex value in several files. Changing a color is not sufficient proof that all affected text and controls retain adequate contrast.

## Source map

Implemented source structure:

- `src/styles/_tokens.scss`: semantic CSS custom properties emitted under `:root`.
- `src/styles.scss`: token import, Material theme, and application-wide defaults.
- `src/app/app.ts`, `src/app/app.html`, `src/app/app.scss`: root router outlet.
- `src/app/app.config.ts`: real router and authenticated HTTP providers.
- `src/app/app.routes.ts`: public login and guarded lazy workspace/Applications routes.
- `src/app/layout/workspace-shell.*`: responsive Material sidenav, identity, sign out, and route breadcrumb.
- `src/app/features/auth/login.*`: typed sign-in form and demo-account controls.
- `src/app/features/applications/`: list page, query/result state, HTTP list access, and permitted draft links.
- `src/app/features/application-wizard/`: step flow, typed form and fields, serialized autosave, draft API, and leave dialog.
- `src/app/core/auth/pending-changes.ts`: connects explicit sign out with the active draft leave check.
- `src/app/features/workspace/workspace.ts`, `.html`, `.scss`: workspace overview page.
- `src/app/features/workspace/application-checklist.ts`, `.html`, `.scss`: preparation checklist dialog.
- `public/application-illustration.svg`: decorative local artwork with empty alternative text in the page. It contains no application data.
- `src/app/shared/ui/icon.ts`: small decorative SVG icon component. Accessible names belong to the surrounding control when an icon is decorative.

Validation outcomes belong in `docs/PROGRESS.md`; learning notes belong in `docs/LEARNING_LOG.md`.

## Historical checkpoint 2 verification

At desktop width, navigation stays visible; at 375px the drawer opens through a labelled menu button. Browser checks confirmed no horizontal overflow, Tab focus wrapping inside the checklist, Escape closing it and restoring opener focus, and nested drawer → checklist → drawer → menu-button focus restoration. The skip link focuses main content without leaving `/overview`. These results describe the checkpoint 2 UI at that time. Current authentication/dashboard verification is recorded separately in [the progress log](PROGRESS.md); this historical note does not claim a complete accessibility audit.
