# Design

A static visual reference for implementing Fathom. This is not the production
frontend. Lit renders the designs; it does not choose the production framework.

See the [agent chat design inventory](chat-design-inventory.md) for conversation
components, content types, and states to explore.

In the viewer, **Components → Composites → Message structure and identity**
contains the first nine studies from that inventory, each on its own page.
Composite pages use catalog `subgroup` labels in the sidebar and component index.
Examples remain beside their owning components; existing page URLs stay stable.

Run `mise run design` from the repository root and open
`http://127.0.0.1:5175`.

## Start with a screen

The `screens/` folder contains the agent, editor, and chat workspaces. Each
`*-screen.ts` shows its main pieces directly. Its adjacent `*.examples.ts`
owns the named states, descriptions, stable links, and preview markup.
`site/screen-catalog.ts` only collects them.

Open a state in the viewer, then use **Screen only** to remove the viewer chrome.
The older `no-session` URLs remain valid; their actual state is **Inspector
closed**, not an empty conversation.

## Where things belong

| Path                   | Owns                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| `tokens.css`           | Shared product colors, typography, spacing, and effects            |
| `primitives/`          | Small controls, icons, status marks, and template helpers          |
| `composites/`          | Meaningful UI pieces, with nearby examples and CSS                 |
| `layouts/`             | Workspace geometry and local sidebar/drawer resizing               |
| `screens/`             | Visible composition and named design states                        |
| `models/`, `fixtures/` | Typed presentation data and realistic sample content               |
| `components/`          | Light-DOM base, shared controls, and isolated behavior demos       |
| `site/`                | Viewer navigation, catalogs, theme control, and viewer-only styles |

Follow a custom tag to its same-named file. Small fragments can be plain Lit
templates. Geometry-only wrappers use native markup and named CSS classes;
they do not need registered elements.

Components receive data through Lit properties, such as
`.messages=${scenario.messages}`. Fixtures stay in screens and examples.
Light DOM shares Tailwind utilities and product tokens. Use `declare` fields
and constructor defaults for Lit properties.

## Editing a design

Read the [design standard](../docs/standards/design-system.md). Change the
smallest owner of the design decision. Keep the screen template readable rather
than hiding it behind configuration or rendering helpers.

Describe what is open, selected, or different in the adjacent screen example.
Application actions are simulated. Sidebar toggling and resizing help inspect
the design; functional control demos stay separate from screen states.

Product tokens belong in `tokens.css`. Viewer-only values belong in
`site/viewer-tokens.css` and are excluded from the product token catalog.

## Checking your work

From `design/`, run `deno task check` for types and `deno task build` for the
static site. There are no tests or screenshot comparison tools.

From the repository root, run `mise run lint:fallow` to find unused files,
exports, types, dependencies, and class members in `design/` only. Fallow is
pinned in `mise.toml`; install it with `mise install` if needed. The check reports
findings and fails without deleting anything. It does not run duplication,
complexity, or style analysis. Its configuration names the viewer entry points
and accounts for Lit's runtime use of static `properties` declarations.

Fallow 3.23.0 also auto-detects `fixtures/` as Vitest entry points in this Vite
project. It cannot currently flag an unused fixture file. Treat dependency
results cautiously too: this project uses Deno's import map, not `package.json`.
Review findings before removing code; this is not proof that every unused item
has been found.

Review affected screens and component examples in the browser, in both themes
and at wide and narrow widths. Look at long content, truncation, overlays, and
resized panes. The workspace keeps its desktop minimum width and scrolls
horizontally when the preview is narrower; this is not a mobile app design.

`vibe-lab.html` is an archived experiment, not a source for new styles.
