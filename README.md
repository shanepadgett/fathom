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

That installs Deno at the version in `mise.toml`. Nothing else is required.

## Run

```bash
deno task dev
```

Builds the UI and opens Fathom in its own window with hot reload. For Chrome
DevTools, run `deno task dev:browser` instead; it prints a launch link and
opens a browser tab.

## Write a plugin

```bash
deno task new hello
```

```text
plugins/hello/
  deno.json            id, backend entry, ui entry
  contract.ts          the API the page may call, as schemas
  backend/mod.ts       serves that API in the Deno process
  ui/mod.tsx           adds a settings section that calls it
  ui/HelloSettings.tsx
```

Restart `deno task dev`; new directories are picked up at start. Open
**Settings** from the gear in the header and **Hello** is in the navigation.
Edit `backend/mod.ts` or `ui/HelloSettings.tsx` and save: the changed half
reloads in place.

## Tasks

| Command                      | Does                                                 |
| ---------------------------- | ---------------------------------------------------- |
| `deno task dev`              | Build, open the native window, reload edited plugins |
| `deno task dev:browser`      | The same in a browser tab, for DevTools              |
| `deno task new <id>`         | Scaffold a plugin under `plugins/`                   |
| `deno task plugin:add <dir>` | Register a plugin outside the repo; starts disabled  |
| `deno task desktop:build`    | Package `dist/Fathom.app`                            |
| `mise run check`             | Format, lint, and type checks                        |

## Learn more

[Concepts](docs/concepts.md) defines the six words the SDK uses.
[Architecture](docs/architecture.md) draws the line between plugin and harness.
The guides in `docs/guides/` each cover one task against the example plugin in
`examples/counter`.
