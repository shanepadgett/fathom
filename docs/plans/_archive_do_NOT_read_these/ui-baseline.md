# UI baseline

Approved direction: a replaceable default shell, SDK UI building blocks and
contracts, and host recovery that survives removal of every UI plugin.

## Implementation

- Host owns shell, page, settings, action, sidebar, and status registries.
  Contributions use full plugin/local IDs. Single slots select explicitly;
  lists order/filter; keyed outlets render the chosen ID. Missing selections
  show a fallback, never silently switch implementations.
- SDK owns reusable controls, slot rendering, production theme tokens, and
  Tailwind compilation. Each plugin ships its own utility CSS without a reset.
- Workspace becomes the default shell contribution. It owns navigation and
  settings presentation, not provider or model behavior. Appearance settings
  persist locally; the host applies them independently of the shell.
- Credentials supplies Providers settings. Plugin management and the model
  workbench supply diagnostic settings. Preserve their backend behavior.
- Remove old workbench chrome, broad control styles, and the workspace panel
  contract. Leave design reference and unfinished feature pages alone.

## Validation

Run lint fixes, formatting, checks, and UI build. Validate shell removal and
recovery, theme changes, settings navigation, and plugin contribution removal
in the browser if available. Do not add tests or custom validation scripts.

## Current result

Implemented the shell, SDK contracts/controls, appearance preferences, provider
settings, diagnostic settings, and per-artifact Tailwind build. Updated
`docs/plugin-authoring.md`; removed the old workspace panel contract and styling.

`mise run lint:fix`, `mise run fmt`, `mise run check`, `deno task build:ui`, and
`git diff --check` pass. An isolated browser instance rendered the empty workspace,
dark appearance, connection status, and independent recovery control.

Still needs an interactive browser pass: settings navigation, persisted theme
changes, sign-in flows, sidebar resizing, shell/plugin removal and recovery.
Slot selection currently uses composition, not a visual editor. Only controls
needed by this baseline were implemented; menus, switches, and other unused
design primitives remain deferred.
