# Design guide

The portal should help users find an application, understand its state, and complete the next permitted action. Visual polish should support those tasks: clear hierarchy, readable forms, predictable controls, and useful feedback.

## Checkpoint 2 scope

Implemented: a responsive application shell, a lazy-loaded workspace overview, and a Material dialog containing a merchant preparation checklist. The overview remains an introductory workspace, not the future application dashboard.

The overview and checklist explain the workflow. They do not create an application. Authentication, API integration, server permissions, drafts, and reviews remain future work. A responsive layout or functioning dialog is evidence of UI behavior, not evidence that those business features work.

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

- **Shell:** The persistent application frame: navigation, brand, skip link, and the outlet for route content. A sidebar can remain visible on wide screens and become compact or collapsible on narrow screens. If collapsed, its toggle must work with the keyboard, expose its expanded state, and preserve sensible focus behavior.
- **Route page:** The content for a particular URL, including its page heading and the actions relevant to that task. The workspace overview is the first page; later dashboard and form pages should focus on doing the work rather than repeating introductory cards.
- **Reusable UI:** A component with a clear repeated purpose, such as a status indicator or an error panel. Extract one when actual reuse warrants it. A checklist dialog is a focused interaction and does not need its own route.

For future data-heavy pages, make the main task and page state immediately visible. Design loading, empty, error, and success states alongside the populated screen. Avoid adding metrics merely to fill a dashboard.

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
- `src/app/app.ts`, `src/app/app.html`, `src/app/app.scss`: shell and responsive Material sidenav.
- `src/app/app.routes.ts`: route registration, including lazy loading for `/overview`.
- `src/app/features/workspace/workspace.ts`, `.html`, `.scss`: workspace overview page.
- `src/app/features/workspace/application-checklist.ts`, `.html`, `.scss`: preparation checklist dialog.
- `public/application-illustration.svg`: decorative local artwork with empty alternative text in the page. It contains no application data.
- `src/app/shared/ui/icon.ts`: small decorative SVG icon component. Accessible names belong to the surrounding control when an icon is decorative.

Validation outcomes belong in `docs/PROGRESS.md`; learning notes belong in `docs/LEARNING_LOG.md`.

## Verified behavior

At desktop width, navigation stays visible; at 375px the drawer opens through a labelled menu button. Browser checks confirmed no horizontal overflow, Tab focus wrapping inside the checklist, Escape closing it and restoring opener focus, and nested drawer → checklist → drawer → menu-button focus restoration. The skip link focuses main content without leaving `/overview`. These checks cover the implemented UI; a full accessibility audit and data-heavy dashboard validation remain future work.
