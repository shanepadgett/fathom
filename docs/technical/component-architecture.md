# Design Component Architecture

The user approved a full Lit conversion of `design/`.
The reference must preserve the visual result and also explain the intended
component boundaries to an implementation agent. This supersedes the earlier
choice of HTML-returning functions and thin screen recipe calls.

Maintenance rules live in the [design system standard](../standards/design-system.md).
Production frontend selection and technical planning remain separate. The static
editor illustrates appearance; it does not replace the production Monaco
requirement or implement application behavior.

## Screen Composition

Two registered screen components own the visible app structure:

```text
agent-screen
  workspace-shell
    workspace-layout
      workspace-header
      workspace-body
        workspace-sidebar → session-sidebar
        conversation-pane
        workspace-sidebar → session-inspector (optional)
      workspace-status-bar
      workspace-scrim → workspace-drawer → diff-pane (optional)
      workspace-overlay → project-picker or chat-search (optional)

editor-screen
  workspace-shell
    workspace-layout
      workspace-header
      workspace-body
        workspace-sidebar → files-sidebar
        editor-pane
      workspace-status-bar
      workspace-scrim → workspace-drawer → conversation-pane (optional)
```

The templates live in `screens/agent-screen.ts` and `screens/editor-screen.ts`.
The two adjacent screen example files select five agent states and three editor states.
The existing eight viewer routes are preserved.

Layout elements do not choose screen content. They own the frame, horizontal
body, sidebars, backdrop, drawer, and overlay geometry. Screens declare their
children directly; there is no separate agent/editor layout recipe to follow.

## Component Boundaries

Composites are registered Lit Web Components. The user approved the
[file boundary split](design-file-boundaries.md), replacing topic-sized modules
with one file per registered component. For example, `conversation-pane.ts`
imports `conversation-header.ts`, `message-transcript.ts`, and
`message-composer.ts` directly. Private helpers remain with their owner.

Examples and CSS sit beside their owners. `styles.css` keeps global setup and
central CSS imports. Layout geometry stays in `layouts/`; the generic resize
handle accepts width bounds supplied by each layout or drawer owner.

Small primitives remain Lit template functions where an extra element would add
no useful boundary. The existing native button wrapper and behavior demos remain
shared. The reference does not introduce a second styling or interaction system.

## Rendering and Data

Lit 3.3.1 provides templates, property bindings, and local element updates.
Light DOM keeps the existing Tailwind utilities and tokens available everywhere.
Visual component hosts use `display: contents`; structural elements have explicit
layout styles. Authored layout children stay in light DOM rather than being
collected, moved, or serialized as slot strings.

Screens and examples import fixtures. Components accept typed presentation data
from `models/`, never routes or app services. Lit escapes text and attribute
values. Code samples are plain syntax tokens with significant whitespace, not
HTML strings. This also prevents HTML formatters from adding blank code lines.

The viewer has separate shell, sidebar, route, page, and theme owners. Catalogs
contain metadata and import adjacent examples. Token previews separate compiled
CSS discovery, section definitions, and sample rendering from view lifecycle.
Sidebar toggles and resizing are local preview
behavior. App buttons, search, file selection, and folder expansion remain
static. Modal/drawer/accordion behavior demos stay isolated.

## Verification

Source checks enforce dependency direction, token use, registered screen
composition, single component ownership, direct child imports, and the absence
of HTML string rendering. Browser contracts check
text escaping, meters, file expansion, code whitespace, element registration,
property updates, and isolation between previews. Each registered component also
loads in a fresh iframe without relying on catalog registration.

Browser checks cover all eight screen states in both themes and two widths,
isolated component examples, viewer navigation, and pointer/keyboard resizing.
Before/after screenshots cover the same matrix. Production focus management,
search, editor integration, and application state are not proven by these static
studies.
