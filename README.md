# Fathom

A coding harness where every feature is a plugin, packaged as a native desktop
app with Deno.

## Install

Fathom pins its toolchain with [mise](https://mise.jdx.dev). If you do not have
it:

```bash
curl https://mise.run | sh
```

Then activate it in your shell and install the pinned tools from the checkout:

```bash
echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc && exec zsh
```

```bash
mise install
```

That installs the tools pinned in `mise.toml`. Nothing else is required.

## Run

```bash
mise run dev
```

Builds the UI and opens Fathom in its own window with hot reload. For Chrome
DevTools, run `mise run dev:browser` instead; it prints a launch link and
opens a browser tab.

## Write a plugin

```bash
mise run new hello
```

```text
plugins/hello/
  deno.json            id, backend entry, ui entry
  contract.ts          the API the page may call, as schemas
  backend/mod.ts       serves that API in the Deno process
  ui/mod.tsx           adds a settings section that calls it
  ui/HelloSettings.tsx
```

Restart `mise run dev`; new directories are picked up at start. Open
**Settings** from the gear in the header and **Hello** is in the navigation.
Edit `backend/mod.ts` or `ui/HelloSettings.tsx` and save: the changed half
reloads in place.

## Tasks

Everything runs through mise. `mise tasks` lists the same set with descriptions.

| Command                        | Does                                                 |
| ------------------------------ | ---------------------------------------------------- |
| `mise run dev`                 | Build, open the native window, reload edited plugins |
| `mise run dev:browser`         | The same in a browser tab, for DevTools              |
| `mise run build:ui`            | Build the app shell and plugin UI bundles            |
| `mise run new <id>`            | Scaffold a plugin under `plugins/`                   |
| `mise run plugin:add <dir>`    | Register a plugin outside the repo; starts disabled  |
| `mise run plugin:remove <dir>` | Unregister a plugin outside the repo                 |
| `mise run desktop:build`       | Package `dist/Fathom.app`                            |
| `mise run design`              | Open the local design system                         |
| `mise run fmt`                 | Format source and project configuration              |
| `mise run fmt:check`           | Check formatting without changing files              |
| `mise run lint`                | Lint TypeScript and Solid code                       |
| `mise run lint:fix`            | Apply safe lint fixes                                |
| `mise run lint:deno`           | Run `deno lint` and check JSR public types           |
| `mise run typecheck`           | Type-check the Deno workspace                        |
| `mise run check`               | Format, lint, and type checks                        |
| `mise run publish:check`       | Dry-run the JSR publish of the SDK                   |

## Learn more

[Concepts](docs/concepts.md) defines the six words the SDK uses.
[Architecture](docs/architecture.md) draws the line between plugin and harness.
The guides in `docs/guides/` each cover one task against the example plugin in
`examples/counter`.
