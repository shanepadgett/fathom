# Repository Guidelines

Fathom is a coding harness where every feature is a plugin: an Elixir and
Phoenix host on the BEAM, rendered by LiveView in a Tauri window. Read
[architecture](docs/architecture.md) for the boundary between plugin and
harness and the seams future work plugs into, and the
[roadmap](docs/plans/README.md) for what comes next. Archived plans under
`docs/plans/_archive_do_NOT_read_these/` are history, not instructions.

## Standards

Read a standard when its reason applies.

| Standard | Read when |
| --- | --- |
| [Plugins](docs/standards/plugins.md) | Changing anything under `plugins/` or `examples/`. |
| [Harness](docs/standards/harness.md) | Changing `apps/fathom`, `apps/desktop`, or `packages/fathom_sdk`. |
| [Phoenix, LiveView, Elixir](apps/fathom/AGENTS.md) | Writing any Elixir, HEEx, or LiveView code. |

## Rules

- Use generators: `mise run new -- <id>` for plugins, the Phoenix and Ecto
  generators inside a plugin project, and extend `mix fathom.gen.plugin`
  rather than hand-writing what every plugin needs.
- After code changes run `mise run fmt`, then `mise run check`.
- Validate by running the app (`mise run dev`, or `mise run dev:browser` for
  IEx and DevTools). Do not add tests or validation scripts unless asked.
- Elixir edits reload in the running app. Restart `mise run dev` after
  changing config, `mix.exs`, adding a plugin directory, or editing Rust.
- Point a run at a throwaway home with `FATHOM_HOME`. Never print saved
  credentials.
- `design/` is the copied design reference. Never reorganize or reformat it.
- Do not commit.
