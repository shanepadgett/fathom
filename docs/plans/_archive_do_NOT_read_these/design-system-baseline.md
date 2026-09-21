# UI platform baseline

Completes the browser side of the [baseline](baseline.md). It ends when the
default shell, settings, and recovery screens render from one owned design
system, plugins compose only shared controls, and a plugin author cannot tell
which controls the core plugins use because there is nothing else to use.

`design/` stays the reference. Everything below translates it; nothing imports it.
The [ui-baseline](ui-baseline.md) result stands: slot contracts, host
registries, recovery, and appearance persistence are done and stay as they are.
This plan finishes the visual layer and fixes where the pieces live.

## What DeepSeek got right, and what we take

The [DeepSeek harness](https://github.com/deepseek-ai/deepseek-harness) browser
is a second plugin runtime with three platform singletons: a slot registry,
a primitives library, and a theme package. Fathom already has the first as
`@fathom/sdk/ui`. The second and third are what this plan builds. Decisions we
adopt, adapted to Solid and Deno:

| DeepSeek | Fathom |
| --- | --- |
| `ui-slots` / `ui-primitives` / `ui-theme` are separate platform singletons; feature plugins cannot import each other's components, so the primitives catalog is the only sharing channel | `@fathom/sdk/ui` keeps contracts; a new `@fathom/ui` package owns tokens, fonts, icons, and controls. Both are host singletons in the import map. Plugins import controls from `@fathom/ui` only |
| Theme is applied before any script runs, from an inline head script, so the first paint is already dark or light | `index.html` gets a pre-paint script that reads the saved appearance and sets `data-theme` and `data-reduced-motion` |
| A settings shell projects nothing into a row; the contributor owns copy, value, and write path | Already true for `SettingsSections`. Kept |
| No component library, no Tailwind; every behavior is hand-written and every string is a prop | Tailwind stays because the reference is written in it. Behavior stays hand-written on native `dialog`, `popover`, `details`, and one roving-focus helper. Labels stay props |
| No web fonts, system stack only | We ship the reference fonts locally. The reference is designed around them |
| Hand-authored SVG icons, no icon library | Phosphor Regular, pinned and staged locally. The reference names its icons in Phosphor terms and a 1,500-glyph set costs two files |
| Every architectural rule has a verify script | Out of scope here by instruction. Rules below are written so they can become checks later |

Decisions we decline: DeepSeek's declaration-merged slot type algebra, the
parallel Factory system, the CommonJS closure loader and combo routes (native ESM
and an import map already do this), i18n dictionaries (English only until a
locale plugin owns it), and a headless behavior library. Kobalte would give
menus and tabs for free, but the surface here is seven controls, the reference
already hand-rolls them on native elements, and owning that code is the point.

## Ownership after this plan

```text
design/                          reference; tokens.css and primitives are the source of truth
packages/ui          @fathom/ui  tokens, fonts, icons, typography roles, controls, control CSS
packages/sdk/src/ui  @fathom/sdk/ui  slot contracts, Slot, createSlotEntries, Client, Appearance token
packages/host-browser            renderer, appearance implementation, ApplicationRoot, RecoveryPanel, app.css
packages/host-deno/build.ts      stages assets, builds singletons, builds the app, bundles plugins
apps/ui                          index.html, main.tsx, import map, pre-paint script
plugins/*/ui                     compose @fathom/ui controls; own feature state and copy
```

Moves this implies, all mechanical:

- `packages/sdk/src/ui/{Button,Input,Select,Textarea,Field,SettingRow,Panel,EmptyState,InlineNotice,Icon,IconButton,Dialog,ResizableSidebar}.*`, `theme.css`, `base.css` → `packages/ui/src/`.
- `packages/sdk/src/ui/renderer.tsx` and the `createAppearance` body → `packages/host-browser/`. The SDK keeps `Appearance`, `AppearanceApi`, `ThemePreference`, `MotionPreference`.
- `apps/ui/styles.css` → deleted; its one rule moves to `packages/host-browser/app.css`.
- `UI_RUNTIME_IMPORTS` gains `@fathom/ui`. The build emits `ui.js` and `ui.css`. `sdk-ui.css` stops existing because the SDK no longer owns CSS.
- `buildStyles` resolves the theme through `import.meta.resolve("@fathom/ui/theme.css")` instead of a path relative to the SDK.

The SDK ends up kernel-shaped: tokens, schemas, contracts, and the slot
renderer. Nothing in it needs a font, a color, or a Tailwind build.

## Assets

Pinned in the root `deno.json` imports and staged by `build.ts` into
`dist/app/assets/`. Licenses are copied beside the files they cover.

| Asset | Package | Files staged | License |
| --- | --- | --- | --- |
| Space Grotesk 400–700 | `@fontsource-variable/space-grotesk` | `files/space-grotesk-latin-wght-normal.woff2`, `latin-ext` variant, `LICENSE` | OFL-1.1 |
| Fragment Mono 400, 400 italic | `@fontsource/fragment-mono` | `files/fragment-mono-latin-400-normal.woff2`, `-italic.woff2`, `latin-ext` variants, `LICENSE` | OFL-1.1 |
| Phosphor Regular | `@phosphor-icons/web` | `src/regular/Phosphor.woff2`, `src/regular/style.css` with its `url()` rewritten to `/assets/icons/`, `LICENSE` | MIT |

`packages/ui/src/fonts.css` is hand-written `@font-face` rules pointing at those
paths with `font-display: swap`. The Phosphor stylesheet is emitted as
`dist/app/assets/icons/phosphor.css` and linked from `index.html`; it is 78 KB
of class selectors and does not go through Tailwind. Nothing requests
`fonts.googleapis.com`. Existing CSP (`default-src 'self'`) already permits
same-origin fonts. Assets sit under the `/` mount, which is `no-store`; that is
acceptable on loopback and avoids a cache-busting scheme for now.

`build.ts` resolves package directories with `import.meta.resolve` followed by
`fileURLToPath`, the same way `workspaceImports` does, so `nodeModulesDir: auto`
keeps working and nothing hardcodes `node_modules`.

## Design system package

```text
packages/ui/
├─ deno.json                 name @fathom/ui; exports ".", "./theme.css", "./typography.css"
└─ src/
   ├─ mod.ts                 exports only
   ├─ theme.css              tokens; copied from design/tokens.css minus viewer/demo tokens
   ├─ typography.css         @utility type-* roles
   ├─ fonts.css              local @font-face rules
   ├─ base.css               body, focus ring, cursor, code, summary marker, reduced motion
   ├─ Icon.tsx               Phosphor class renderer, IconName union, four sizes
   ├─ Button.tsx             primary | secondary | quiet; compact | small | normal; iconOnly
   ├─ IconButton.tsx         quiet small icon-only Button with required label; toolbar size
   ├─ Input.tsx  Select.tsx  Textarea.tsx  Checkbox.tsx  Switch.tsx
   ├─ Field.tsx              label, description, error wiring
   ├─ SettingRow.tsx         min-h-20 row; label + description + control
   ├─ Card.tsx               was Panel; rounded-lg border bg-surface; inset | flush padding
   ├─ NavItem.tsx            settings/provider navigation row; icon, label, trailing, aria-current
   ├─ StatusDot.tsx          tone dot; labelled or decorative
   ├─ Chip.tsx  Meter.tsx  ShortcutHint.tsx  EmptyState.tsx  InlineNotice.tsx
   ├─ Tabs.tsx               tab strip; roving focus; aria-pressed per reference
   ├─ Menu.tsx  Menu.css     popover menu; sections, items, roving focus, Escape returns to anchor
   ├─ Accordion.tsx  Accordion.css   details name= single-open groups
   ├─ Dialog.tsx  Dialog.css        native modal; overlay-glass backdrop; enter/exit motion
   ├─ ResizableSidebar.tsx  ResizableSidebar.css  edge handle per reference edge-resizer
   ├─ roving-focus.ts        arrow/Home/End traversal shared by Menu and Tabs
   └─ anchor-position.ts     fixed-position a popover under its trigger, clamped to the viewport
```

Rules for the package:

- Zero dependencies beyond `solid-js`. It never imports `@fathom/sdk`, the
  kernel, or a host. It knows nothing about plugins.
- Every control takes props and children. No control reads a service, a store,
  or `location`. All user-visible strings arrive as props; nothing has fallback
  copy. `IconButton` and `Switch` require `label`.
- Variants and sizes come from the reference and nowhere else. Reference
  `button.ts` has `primary | secondary | quiet` and `compact | small | normal`.
  There is no `ghost` and no `danger`; the reference Disconnect is a secondary
  button. Remove both from `Button`, and remove the removal confirmation dialog
  in credentials, because the reference disconnects directly.
- Component CSS sits beside its TSX and is imported from it. Prefer utility
  classes; write a CSS file only where the reference did (overlay motion,
  `::backdrop`, `::details-content`, `popover`, the resize handle).
- Tokens are semantic only in controls: `bg-canvas`, `bg-surface`, `text-ink`,
  `text-muted`, `border-line`, `border-control-line`, `text-action`,
  `bg-action`, `text-on-action`, tone colors. No raw palette steps outside
  `theme.css`.

### Typography roles

`typography.css` defines Tailwind utilities so any artifact can use them
through `@reference`. Each role is one reference pairing, named for use:

| Utility | Reference source | Composition |
| --- | --- | --- |
| `type-title` | provider header `h1` | `text-2xl font-semibold` |
| `type-section-title` | `.settings-section-title` | `text-lg font-semibold tracking-tight` |
| `type-eyebrow` | `.settings-eyebrow` | `font-mono text-micro tracking-wide text-muted` |
| `type-label` | setting row label | `text-sm font-medium` |
| `type-description` | setting row description | `text-dense text-muted` |
| `type-dense` | nav items, inputs | `text-dense` |
| `type-micro` | dividers, hints | `text-micro text-muted` |
| `type-code` | `code` base rule | `font-mono text-base` |
| `type-wordmark` | `fathom-wordmark` | `font-bold tracking-tight whitespace-nowrap` |

Native headings keep their meaning; roles style them. The design viewer's own
headings are not product roles and are not ported.

### Icons

`Icon` renders `<i class="ph ph-{name} shrink-0 {size}" aria-hidden="true">`.
Sizes `small | normal | large | toolbar` map to `text-xs | text-base | text-lg |
text-xl` as in the reference. `IconName` is the reference union in
`design/primitives/icon.ts` plus `sidebar-simple`, `gear`, `x`, `arrow-left`,
`plugs`, `sliders-horizontal`, `magnifying-glass`, which the shell and settings
use. Extend the union when a screen needs a glyph; do not widen it to `string`.
Plugins outside the repo can still write `class="ph ph-name"` because the font is
global, but they lose the type check.

### Behavior helpers

Two files carry all keyboard behavior so Menu, Tabs, and later controls do not
each grow a copy:

- `roving-focus.ts`: given a container and an item selector, handles
  ArrowUp/Down or Left/Right, Home, End, wrapping, and returns a cleanup.
  Reference: `context-menu.ts#keydown`.
- `anchor-position.ts`: positions a `popover="auto"` element below or above its
  trigger, aligned start, clamped to the viewport, re-run on scroll and resize.
  Roughly twenty lines; no floating library.

Dialog keeps native `showModal`, `cancel` handling, and focus restoration as
today, and gains the reference enter/exit motion and `overlay-glass` backdrop.
Accordion is `<details name>`. Drawer, RadioGroup, and Tooltip are deferred until
a screen needs them; the reference drawer is mostly a demo driver.

## Shell and settings geometry

The slot set and modes are unchanged. `NamedContribution` gains an optional
`icon: IconName` so settings navigation can show the reference glyphs; the
workspace, credentials, llm, and plugin-manager entries set it.

```text
ApplicationRoot                    host; Slot(AppShell) single; fallback EmptyState
└─ WorkspaceShell                  workspace plugin
   ├─ min-w-workspace-minimum, h-dvh, horizontal scroll below minimum (reference)
   ├─ WorkspaceHeader              h-12 bg-surface border-b; wordmark, sidebar IconButton toolbar,
   │                               Slot(HeaderActions), gear IconButton → settings
   ├─ workspace area
   │  ├─ ResizableSidebar          w-sidebar default; bounds 180–560; Slot(LeftSidebar) single
   │  ├─ pages nav + Slot(Pages) keyed
   │  └─ ResizableSidebar right    Slot(RightSidebar) single
   ├─ SettingsPage                 header keeps wordmark; close is IconButton "x" toolbar
   │  ├─ nav w-48 bg-surface border-r; NavItem per SettingsSections entry (icon + label)
   │  └─ main overflow-y-auto; Slot(SettingsSections) keyed; content max-w-3xl px-10 py-8
   └─ footer                       min-h-12 bg-surface border-t text-sm; Slot(StatusItems); connection
RecoveryPanel                      host mount outside root; Card + Button; app.css positions it
```

Settings sections follow the reference `GeneralSettings`/`ProviderSettings`:
`type-section-title`, then `Card` with `SettingRow`s. Provider settings keep
their second navigation column at `w-48` using `NavItem` with a `StatusDot`
trailing. The provider header uses the monogram badge, `type-title`, and a
`type-description` connection state. The API key form is `Field` + `Input
type=password` + primary compact Connect, with a secondary Disconnect when
connected. Login status and reply UI reuse `Button` sizes from the reference
`DeviceCodeSignIn`.

GeneralSettings exposes Theme (Select) and Reduce motion (Switch). Interface
density, display name, default view, and notifications exist in the reference but
have no backing service or tokens; they are not built.

Plugin manager and model diagnostics adopt `Card`, `SettingRow`-style rows, and
`type-*` roles. Their behavior does not change.

## Build call graph

```text
packages/host-deno/build.ts
├─ stage assets → dist/app/assets/{fonts,icons}/… + licenses; rewrite phosphor url()
├─ singletons: solid.js  solid-web.js  solid-store.js  sdk.js  sdk-ui.js  ui.js
│  └─ ui.css = buildStyles(base=true): tailwind + theme + fonts + base + typography
│                                       + control CSS + utilities used in packages/ui
├─ app.js + app.css: apps/ui/main.tsx with host-browser aliased; utilities used by host files
└─ bundleUi(plugin) → entry.js + style.css: @reference theme + typography; plugin utilities
                      + plugin component CSS; no reset, no fonts, no theme

apps/ui/index.html
├─ inline pre-paint script: data-theme, data-reduced-motion from localStorage / media queries
├─ <link> /assets/icons/phosphor.css, /ui.css, /app.css
├─ import map: solid-js*, @fathom/sdk, @fathom/sdk/ui, @fathom/ui
└─ <script type=module src=/app.js>
```

`bundleUi` keeps its "second Solid runtime" guard and adds the same check for
`@fathom/ui`, so a plugin cannot bundle a private copy of the controls.
`BrowserLoader` already refuses artifacts whose externals miss a runtime import;
after the change every artifact must be rebuilt once.

The pre-paint script duplicates the read half of `createAppearance` in about ten
lines. That duplication is deliberate: the service must not run before the module
graph loads, and the paint must not wait for it.

## Status

Implemented in five steps. Every step ended with `mise run lint:fix`,
`mise run fmt`, `mise run check`, and `deno task build:ui`; all four passed at
each step boundary and on the final tree. No step was left with failing checks,
and nothing is committed; all changes are in the working tree.

### What was built

1. **Move.** `packages/ui` (`@fathom/ui`) now owns the controls, `theme.css`,
   `base.css`, `Dialog.css`, and `ResizableSidebar.css`. `renderer.tsx` and the
   `createAppearance` implementation moved to `packages/host-browser`; the SDK
   keeps `Appearance`, `AppearanceApi`, and the preference types.
   `packages/sdk/src/ui/slot-context.ts` exports `SlotsContext` with an
   explicit type because the host renderer provides it. `apps/ui/styles.css`
   was deleted and its rule moved to `packages/host-browser/app.css`.
   `UI_RUNTIME_IMPORTS` gained `@fathom/ui`; the build emits `ui.js` and
   `ui.css` and no longer emits `sdk-ui.css`. `buildStyles` resolves the theme
   through `import.meta.resolve("@fathom/ui/theme.css")`, which also makes
   `packages/ui/src` the base directory for `base.css`, `fonts.css`,
   `typography.css`, and plugin `@reference` lines. Every plugin and host
   import was updated, and `.pi/contexts/*.toml` paths were updated with the
   moves.
2. **Assets and roles.** The root import map pins
   `@fontsource-variable/space-grotesk@5.3.0`, `@fontsource/fragment-mono@5.3.0`,
   and `@phosphor-icons/web@2.1.2`. `build.ts` resolves package directories with
   `import.meta.resolve` + `fileURLToPath`, stages the font WOFF2 files and the
   Phosphor WOFF2 under `dist/app/assets/{fonts,icons}`, copies each license
   beside its files (`LICENSE-space-grotesk`, `LICENSE-fragment-mono`,
   `LICENSE-phosphor`), and rewrites the Phosphor stylesheet `url()`s to
   `/assets/icons/`. Added `fonts.css` (six hand-written `@font-face` rules),
   `typography.css` (the nine role utilities), the Phosphor `Icon` rewrite with
   the closed `IconName` union plus `arrow-left`, the base `code` and summary
   marker rules, a `.woff2` content type, and the index.html pre-paint script.
   `index.html` links `/assets/icons/phosphor.css`.
3. **Controls.** `Button` now has `primary | secondary | quiet` and
   `compact | small | normal` plus `iconOnly`; `ghost` and `danger` are gone.
   `IconButton` is the reference quiet/small icon-only button with a required
   `label`, `toolbar` icon size, and `sidebarToggle` data attribute. `Input`,
   `Select`, `Textarea`, `Field`, `SettingRow`, `Card` (was `Panel`), `Dialog`,
   `ResizableSidebar` (bounds 180–560, `w-sidebar` 240 default, double-click
   and Enter reset), `EmptyState`, and `InlineNotice` follow the reference.
   Added `Switch`, `Checkbox`, `NavItem`, `StatusDot`, `Chip`, `Meter`,
   `ShortcutHint`, `Tabs`, `Menu` + `Menu.css`, `Accordion` + `Accordion.css`,
   and the shared `roving-focus.ts` and `anchor-position.ts` helpers.
4. **Screens.** `WorkspaceShell`, `WorkspaceHeader`, `SettingsPage`,
   `GeneralSettings`, `ProviderSettings` and its children, `ModelWorkbench`,
   `ModelPicker`, `PluginManagerPanel`, `RuntimeControls`, and `RecoveryPanel`
   follow the reference geometry and typography. `NamedContribution` gained
   `icon?: IconName`, and the workspace, credentials, llm, and plugin-manager
   settings entries set it. The credentials removal confirmation dialog was
   deleted; Disconnect is a secondary button. `WorkspaceShell.css` and
   `RecoveryPanel.css` were deleted; the remaining rules are utilities or live
   in `packages/host-browser/app.css`.
5. **Docs.** `docs/plugin-authoring.md` documents the `@fathom/ui` import, the
   control table, typography roles, and icon usage. The ownership tables in
   `docs/plans/baseline.md` and `AGENTS.md` gained the UI package row, and
   `.pi/contexts/*.toml` reference the new files.

### Commands

Run from the repository root, once per step and again on the final tree:

- `mise run lint:fix` — 0 warnings, 0 errors across 144 files.
- `mise run fmt` — rewrote nothing; `mise run fmt:check` passes on 173 files.
- `mise run check` — formatting, `oxlint`, `deno lint`, and `deno check` all
  pass.
- `deno task build:ui` — `Built app and 4 UI plugins.` The build emits
  `ui.js`/`ui.css`, `app.js`/`app.css`, `sdk.js`, `sdk-ui.js` (no CSS), the
  three Solid singletons, and the staged assets.
- `deno check packages/ui/src/mod.ts` — passes. The package is not part of the
  existing `check` task entry list; plugins import it, and this direct check
  covered the controls that no screen uses yet.

### Decisions made beyond the plan text

- The host `ui.css` source list includes the `@fathom/sdk/ui` bundle inputs so
  the SDK's remaining utility classes (the `Slot` error fallback) keep their
  styles after `sdk-ui.css` stops existing.
- The build removes `dist/app` and `dist/plugins` before writing; artifact
  names are content-addressed and stale files were accumulating.
- `bundleUi` refuses a plugin that inlines `packages/ui` sources, mirroring its
  second-Solid-runtime guard.
- `Input`, `Select`, and `Textarea` drop the old `w-full` default; call sites
  set width (`w-44`, `flex-1`, `w-full`) as the reference does.
- `InlineNotice`, `Field`, and `Checkbox` have no reference example; they keep
  the smallest shape consistent with the reference type roles.
- The API key form submits the key in one step: `create-connections.ts` gained
  `connect()`, which starts the login and sends the reply. `LoginStatus` keeps
  the reply form as the fallback for other prompts.
- Settings section icons are `sliders-horizontal`, `plugs`, `robot`, and
  `tree-structure`. The first two are reference glyphs; the plan did not name
  the other two.
- The provider monogram is the first letter of the provider label; the
  credentials contract has no monogram field.
- `IconButton.sidebarToggle` sets only `data-sidebar-toggle` and lets the caller
  pass `aria-expanded`, because the workspace toggle is bidirectional.
- `Switch` is one native checkbox with the knob drawn by `::after`, as in the
  reference `.setting-switch`; it sits inside `SettingRow`'s label without a
  wrapper element.
- `ApplicationRoot`'s no-shell fallback uses the reference `EmptyState` rather
  than custom heading markup.

### Review pass

A second pass reviewed the implementation against the reference and this plan
and changed the following:

- `Button` resolves variant and size in `Button.css` through `data-variant`,
  `data-size`, and `data-icon-only`, mirroring `design/primitives/button.css`
  rule for rule instead of rebuilding the cascade in TypeScript. `Menu` items
  are quiet `Button`s with the reference `context-menu-action` overrides.
- `Card` takes `padding="content"` (all sides, the reference `.settings-card`)
  or `padding="rows"` (sides only, `.settings-section-card`); the earlier
  `inset`/`flush` names were inverted.
- `Dialog.css` uses `@layer components` and `@apply` like the other control
  stylesheets. `Dialog` handles Escape itself, keeps `cancel` prevented, and
  syncs the owner when the browser closes the dialog on its own.
- Reduced motion is a token override on `:root[data-reduced-motion="true"]`
  beside the `prefers-reduced-motion` media query, matching the reference. The
  `!important` sweep over every element is gone.
- `Accordion` resolves children once with Solid's `children()` helper instead of
  re-evaluating the children getter inside an effect.
- `Menu` focuses its first item on open. `ResizableSidebar` ends a drag on
  window blur and leaves inner padding to the contributor.
- `packages/host-browser/app.css` uses `@apply` with theme tokens.
- Plugin fixes: the workspace shell receives explicit props instead of the
  whole dependency bag; page navigation uses the reference `Tabs` strip; the
  header gear carries the reference `mx-3`; the API key form no longer doubles
  `Field`'s gap; plugin-manager rows live in `PluginRow.tsx` and the status
  card hides when empty; recovery uses compact buttons (the `small` size has no
  horizontal padding and is for icon-only use).
- `deno task check` includes `packages/ui/src/mod.ts`. `.claude/launch.json`
  starts the dev host for the desktop app's browser pane.

### Proof

Verified in the desktop app's browser pane on the reviewed build, at 1280×800
(the shell's minimum width is 1088px), light and dark:

- The workspace shell, settings General, Providers, Model diagnostics, and
  Plugins screens render with no console errors. Fonts resolve to Space
  Grotesk from `/assets/`; Phosphor glyphs render in the settings navigation.
- General: the Theme select switches light/dark/system and persists to
  `fathom.theme`; the Switch toggles, moves its knob, persists `fathom.motion`,
  sets `data-reduced-motion`, and drives `--motion-duration-*` to `0ms`.
- Providers: the two-column navigation, monogram header, "Sign in with" row,
  OR divider, and API key form match the reference `settings-general` layout.
  Status dots report connected and not-connected providers correctly.
- Plugins: the configure dialog opens with focus on its close button, closes on
  Escape and on the close button, and returns focus to the Configure button
  that opened it. The empty status card no longer renders.
- Disabling the workspace plugin shows the host empty state; Plugin recovery
  stays styled and operable; enabling it restores the shell on the same route.
- Disabling the credentials UI plugin removes the Providers navigation item and
  section together; enabling it restores both.

Not verified:

- Pointer drag, arrow keys, Home, End, and double-click on the sidebar handle
  (no plugin contributes a sidebar yet, so the handle never renders).
- `Menu`, `Tabs` arrow traversal, `Accordion`, `Chip`, `Meter`,
  `ShortcutHint`, and `Checkbox` in a live screen (no screen uses them yet;
  their CSS compiles into `ui.css`).
- Fonts and icons with the network throttled offline after first load.
- Field error state and the connection-lost state.

The optional `dev:watch` accelerator was not built; it is not required to
close this plan.

## Proof

Verified in a browser (steps 1 and 2, before the browser pass was stopped):

- Step 1: the workspace, settings General, Providers, Model diagnostics, and
  Plugins screens rendered and the recovery surface stayed operable, in light
  and dark themes, with no console or page errors. No pixel comparison against
  the pre-move build was captured.
- Step 2: computed `font-family` resolved to `"Space Grotesk", system-ui,
  sans-serif`; the Space Grotesk latin face, the Fragment Mono latin face (when
  mono text rendered), and Phosphor all loaded from `/assets/`; the header gear
  glyph rendered through the Phosphor face; every request observed by the
  browser was `http://127.0.0.1:5173` (no request left the origin).
- Step 2: with all scripts blocked, the inline pre-paint script set
  `data-theme="dark"` and `data-reduced-motion="true"` from localStorage while
  the emulated OS preference was light, so the saved theme paints before the
  module graph loads.
- Static, on the final build output: each plugin `style.css` contains no
  `@font-face`, `@theme`, or reset block; the `type-*` roles compile into both
  `ui.css` and plugin CSS.

Not verified. The browser pass for steps 3 and 4 was stopped by instruction, so
these items from the Proof list below are unverified:

- Shell header, sidebar, footer, and settings geometry compared side by side
  with the reference `settings-general` and `agent-focus` screens.
- Each new control checked against its reference example in both themes.
- Keyboard behavior: Tab order through the header, settings nav, and a provider
  form; Menu and Tabs arrow traversal; Dialog focus trap and restore; sidebar
  handle arrows, Home, End, and double-click reset.
- States: disabled controls, field error, empty settings section, empty shell,
  failed plugin view, connection lost.
- Reduced motion honored by Dialog and sidebar transitions through the OS
  setting or the Switch.
- Disabling the workspace plugin and recovering, then re-enabling.
- Disabling credentials and confirming the Providers nav item and section
  disappear together.
- The offline-throttle reload of Proof item 1; only the no-external-request
  half was exercised.

The optional `dev:watch` accelerator was not built; it is not required to
close this plan.

## Proof

Manual, in a browser, both themes, at the workspace minimum width and wide:

- Fonts and icons render from `/assets/` with the network throttled offline
  after first load. No request leaves the origin.
- Shell header, sidebar, footer, and settings geometry match the reference
  `settings-general` and `agent-focus` screens side by side.
- Keyboard: Tab order through header, settings nav, and a provider form; Menu
  and Tabs arrow traversal; Dialog focus trap and restore; sidebar handle arrow,
  Home, End, double-click reset.
- States: disabled controls, field error, empty settings section, empty shell,
  failed plugin view, connection lost.
- Reduced motion honored by Dialog and sidebar transitions when the OS setting
  or the Switch is on.
- Disable the workspace plugin; recovery remains styled and operable; re-enable.
- Disable credentials; the Providers nav item and section disappear together.
- Each plugin `style.css` contains no reset, `@font-face`, or theme block.

Build success is not visual acceptance. Anything not exercised is listed as
unverified in the status section when this plan closes. No tests or validation
scripts are added.

## Deferred

Drawer, RadioGroup, Tooltip, Toast, and a search-in-settings surface until a
plugin needs them. Interface density tokens. Locale dictionaries. A visual slot
composition editor. Content-addressed asset names and an immutable `/assets/`
mount. Enforcement scripts for the rules above. Chat, editor, session, and agent
pages belong to their own plans.
