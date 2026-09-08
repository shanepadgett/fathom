# Design

Run `mise run design` from the repository root. The site opens at
`http://127.0.0.1:5175`. Stop it with Ctrl+C. Deno runs Vite and Tailwind v4.
This reference is independent of the application prototypes and does not select
its production frontend framework.

## Composition

- `tokens.css`: theme values, semantic roles, and app-specific utility
  categories.
- `primitives/`: typed icon, control, status, tab, meter, and keyboard
  renderers.
- `components/`: existing light-DOM Web Components; the button renderer uses the
  same `ds-button` styles as existing examples. Overlay and accordion behavior
  demos stay isolated from static workspaces.
- `composites/`: reusable conversation, files, sessions, search, inspector,
  editor, review, and workspace chrome. Related small components share a module.
- `layouts/`: the slot-based workspace shell and agent/editor assembly recipes.
- `models.ts`: presentation data contracts without application services.
- `fixtures/`: one shared scenario plus trusted code/diff samples.
- `screens/`: fixture and explicit state selection, with no bespoke markup.
- `site/`: functional reference viewer, navigation, themes, and token
  inspection.
- `verification/`: checks and the repository's local verification hook.

A screen selects `base`, `no-session`, `diff`, `projects`, or `chat-search` for
the agent layout, or `files`, `changes`, or `agent` for the editor layout.
Application actions are simulated. Sidebar visibility and pane resizing work in
the previews. Folder expansion and selected tabs are rendered state, not
interactive controls. Switch screens through the viewer navigation. Workspace
overlays and drawers cover the complete workspace frame. Each screen detail page
has a **Screen only** link beside its title that opens the screen without viewer
navigation, headings, padding, or the preview frame. The workspace fills the
viewport height; use the floating, bottom-center **Back to details** button to
return to the screen detail page. Drawer open controls live in the app title
bar; reverse-direction close controls live in each drawer header.

## Maintaining the Reference

Before changing the design system, read the
[design system maintenance standard](../docs/standards/design-system.md). It
owns component boundaries, token policy, preview behavior, and verification. You
do not need that standard when using this reference to implement application
code elsewhere.

The [component architecture record](../docs/technical/component-architecture.md)
provides background and component inventories.

## Archived Experiment

`vibe-lab.html` is a standalone historical visual exploration, excluded from the
maintained component catalog and design-system styling checks. Its bespoke CSS
is not a source for new components or screens.
