# UI

UI code is Solid rendered in the page. Plugins contribute to slots; the SDK
provides the controls and theme.

## Runs in the page

The SDK, kernel, renderer, and every plugin `ui/` entry are bundled for the
page by esbuild, which resolves workspace and npm packages but not `jsr:`.
Page-side code uses web platform APIs and the SDK only: no `@std`, and nothing
that needs eval, since the page's content security policy forbids it. `@std`
belongs in the server, the app, scripts, and plugin backends.

## Files

- One named component per PascalCase `.tsx` file. Its stylesheet, if any, sits
  beside it with the same name. Inline list items and registration callbacks
  are fine; do not gather independent components into one file.
- Non-component modules are named for their responsibility, in kebab-case.

## Components

- Read props inside JSX or effects. Never destructure `props`; use `splitProps`
  to forward the rest.
- Subscribe in `onMount` and release in `onCleanup`. Registry `subscribe`,
  `watch`, and `onReset` callbacks are reactive boundaries for the lint rules.
- Iterate with `<For>`, branch with `<Show>`. When a `<Show>` callback closes
  itself, read what you need from the accessor before the state change.
- Wrap settings content in `SettingsSection`; group rows in `Card` with
  `SettingRow`.
- Get the `solid/reactivity` lint clean by restructuring first. Disable it on a
  line only with the reason, such as reading an initial value once.

## Styling

- Utility classes compile per plugin against the SDK theme. Use semantic
  tokens: `bg-canvas`, `bg-surface`, `text-ink`, `text-muted`, `border-line`,
  `bg-action`, `text-on-action`, `text-success`, `text-warning`,
  `text-danger`. Never a raw palette or hex value.
- Text roles are `type-title`, `type-section-title`, `type-eyebrow`,
  `type-label`, `type-description`, `type-dense`, `type-micro`, `type-code`.
  Do not set font size, weight, or family directly.
- Icons are `IconName` values through `Icon`.
- Extra plugin stylesheets are listed under `fathom.styles` in the manifest.
  Plugin bundles must not contain a second Solid runtime or the SDK controls;
  the build fails when they do.

## Controls in `packages/sdk/src/ui/controls`

- Import `solid-js` only. Take props and children. No tokens, client, kernel,
  host, or fallback copy.
- Variants and sizes are `data-*` attributes resolved in the sibling `.css`,
  mirroring the file under `design/` the comment names.
- The component does not import its stylesheet. Add it to
  `src/ui/theme/styles.css`.
- Export from `controls/mod.ts`.

## Verify

Run `mise run dev:browser` for DevTools. Check light and dark by toggling the
`data-theme` attribute. SDK edits need a restart of the dev task; plugin edits
reload in place.
