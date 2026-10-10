# Fathom

A coding harness where every feature is a plugin. Elixir and Phoenix on the
BEAM, rendered by LiveView in a native Tauri window.

## Install

Fathom pins its toolchain with [mise](https://mise.jdx.dev). If you do not have
it:

```bash
curl https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc && exec zsh
```

Then, from the checkout:

```bash
mise install
mise run setup
```

That installs Erlang/OTP, Elixir, Rust, and the Tauri CLI, then fetches
dependencies. Nothing else is required.

## Run

```bash
mise run dev
```

Opens Fathom in its own window. Save any Elixir file in the host, the SDK, or
a plugin and the running app reloads it in place. `mise run dev:browser` runs
the same app in IEx and opens a browser tab, for DevTools and for calling any
plugin's context from the shell.

## Write a plugin

```bash
mise run new -- hello
```

```text
plugins/hello/
  mix.exs                         an OTP application named in :fathom_plugin
  lib/hello.ex                    the context: the plugin's public API
  lib/hello/plugin.ex             the manifest: requires, provides, contributions
  lib/hello/application.ex        the supervision tree, ending with the publisher
  lib/hello_web/settings_live.ex  a settings section
```

Restart `mise run dev`; new directories are picked up at start. Open
**Settings** from the gear in the header and **Hello** is in the navigation.
Edit `settings_live.ex` and save: it re-renders in place, state intact.
[Write a plugin](docs/guides/write-a-plugin.md) walks through the counter
example.

## Tasks

Everything runs through mise. `mise tasks` lists the same set.

| Command | Does |
| --- | --- |
| `mise run setup` | Fetch Elixir and Rust dependencies and asset tools |
| `mise run dev` | Open the native window; Elixir edits reload in place |
| `mise run dev:browser` | The same host in IEx, in a browser tab |
| `mise run new -- <id>` | Generate a plugin under `plugins/` |
| `mise run desktop:build` | Build the release and package `Fathom.app` |
| `mise run design` | Open the local design system |
| `mise run fmt` | Format Elixir and Rust |
| `mise run check` | Formatting, Elixir warnings everywhere, and clippy |

## Learn more

[Architecture](docs/architecture.md) draws the line between plugin and harness
and names the seams. [Plugin standards](docs/standards/plugins.md) and
[harness standards](docs/standards/harness.md) hold the rules.
