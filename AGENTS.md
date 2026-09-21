# Repository Guidelines

Fathom is a coding harness where every feature is a plugin, shipped as a native
desktop app with Deno. Read [architecture](docs/architecture.md) for the
boundary between plugin and harness, and the [roadmap](docs/plans/README.md)
for what comes next. Archived plans under
`docs/plans/_archive_do_NOT_read_these/` are history, not instructions.

## Standards

Read a standard when its reason applies.

| Standard                                   | Read when                                                            |
| ------------------------------------------ | -------------------------------------------------------------------- |
| [TypeScript](docs/standards/typescript.md) | Writing or changing any `.ts` or `.tsx`.                             |
| [Plugins](docs/standards/plugins.md)       | Changing anything under `plugins/` or `examples/`.                   |
| [UI](docs/standards/ui.md)                 | Writing Solid components, styles, or SDK controls.                   |
| [SDK](docs/standards/sdk.md)               | Changing `packages/sdk`, its exports, or published types.            |
| [Harness](docs/standards/harness.md)       | Changing `packages/kernel`, `server`, `renderer`, or `apps/desktop`. |

## Rules

- After code changes run `mise run lint:fix`, `mise run fmt`, then
  `mise run check`.
- Validate by running the app. Do not add tests or validation scripts unless
  asked.
- Restart `mise run dev` after edits to the SDK, kernel, server, renderer, or
  app; plugin edits reload in place.
- Point a run at a throwaway home with `FATHOM_HOME`. Never print saved
  credentials.
- `design/` is the copied design reference. Never reorganize or reformat it.
- Do not commit.
