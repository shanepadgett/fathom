# Design

Run `mise run design` from the repository root. The reference opens at
`http://127.0.0.1:5175`. Deno runs Vite and Tailwind v4; Lit renders the
components. This is a static design reference, not the production frontend.

## Start With a Screen

- [`screens/agent-screen.ts`](screens/agent-screen.ts) registers
  `<agent-screen>`. Its template shows the header, session sidebar,
  conversation, inspector, footer, and optional overlays.
- [`screens/editor-screen.ts`](screens/editor-screen.ts) registers
  `<editor-screen>`. Its template shows the file sidebar, editor, footer, and
  optional conversation drawer.
- [`screens/agent-screen.examples.ts`](screens/agent-screen.examples.ts) and
  [`screens/editor-screen.examples.ts`](screens/editor-screen.examples.ts)
  select the eight displayed states. They are previews, not screen
  implementations.

Follow a tag into its same-named module to see the next level of composition.
For example, `<conversation-pane>` contains `<conversation-header>`,
`<message-transcript>`, and `<message-composer>`. The transcript contains
`<chat-message>` elements. These boundaries describe how the app can be
assembled in Solid or another framework; Lit does not select that framework for
production.

## Ownership

| Path                   | Owns                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `tokens.css`           | Shared visual values and theme roles                                                       |
| `primitives/`          | Small Lit templates for icons, native controls, status, meters, and hints                  |
| `components/`          | Light-DOM base, button wrapper, shared resizing, and isolated behavior demos               |
| `composites/`          | One registered UI component per file, with private helpers and nearby examples             |
| `layouts/`             | Structural elements, sidebar sizing, and adjacent geometry CSS                             |
| `screens/`             | Registered screen components, fixture selection, and visible state                         |
| `models/`, `fixtures/` | Subject-specific presentation records and fixtures; `workspace-scenario.ts` assembles them |
| `site/`                | Viewer shell, sidebar, catalogs, routes, theme control, and token inspection               |
| `verification/`        | Source rules and real-browser component and visual checks                                  |

Components use light DOM so Tailwind and the token system remain shared.
`DesignElement` gives visual component hosts `display: contents`; their native
HTML owns semantics and appearance. Structural layout elements instead own their
boxes through shared CSS. Their authored children stay in place. They do not
emulate Shadow DOM slots or move child nodes.

Pass records with Lit property bindings such as
`.messages=${scenario.messages}`. Use attributes for simple named presentations,
such as `presentation="drawer"`. Lit properties use `declare` fields and
constructor defaults so TypeScript class fields do not hide Lit's property
accessors.

`site/component-catalog.ts` and `site/screen-catalog.ts` own preview metadata,
not markup. Example files sit beside the components they show. `styles.css`
contains global setup and imports owner-specific styles. The resize handle owns
pointer/keyboard input; each layout or drawer supplies its bounds.

## Preview Behavior

Application actions are simulated. Folder expansion, selected tabs, and overlays
are supplied screen states. Sidebar visibility and pane resizing work locally
within each preview. Functional modal, drawer, and accordion demos stay separate
from workspace screens.

The viewer supports both themes and narrow windows. Each screen detail page has
a **Screen only** link that fills the viewport without viewer chrome. The
floating **Back to details** link returns to its catalog page.

## Verification

From `design/`, run `deno task check` and `deno task build`. With the design
server running, `python3 verification/browser.py` checks all eight states in
both themes and two widths, plus isolated module loading, component contracts,
navigation, and resizing. Browser scenarios live in
`verification/browser_cases/`; the runner and driver stay separate. It saves
screenshots in `/tmp/fathom-component-verification`; set `FATHOM_VERIFY_OUTPUT`
to keep a separate before/after set.

Before editing, read the
[design system standard](../docs/standards/design-system.md). The
[architecture record](../docs/technical/component-architecture.md) explains the
conversion and its limits.

`vibe-lab.html` is an archived visual experiment, not part of the maintained
catalog or a source for new component styles.
