# Harness

The harness is `packages/kernel`, `packages/server`, `packages/renderer`, and
`apps/desktop`. It holds only what a plugin needs in order to exist.

## Rules

- No feature behavior. A harness module that knows about models, sessions,
  providers, or a specific page belongs in a plugin.
- Dependency direction: plugins depend on the SDK; the kernel depends on the
  SDK; server and renderer depend on the kernel; the app depends on server and
  renderer. Nothing imports a plugin. The harness discovers them.
- The kernel's dependency analysis and graph reporting stay separate from the
  lifecycle transaction owner.
- Server routes are loopback only and check the launch token. Add a route in
  `packages/server/bridge.ts`; give its payload a schema in the SDK.
- The renderer must render its recovery panel with every UI plugin removed.
- `apps/desktop` is the composition root: window, menu, lifecycle, and the
  choice between native window and browser fallback. Nothing else creates
  windows or reads process arguments.
- Package `mod.ts` files are export-only.
- Both `deno desktop` commands, hot reload in `scripts/dev.ts` and
  `desktop:build`, embed `plugins/` with `--include`. Workspace imports such as
  `@fathom/credentials/contract` resolve inside the compiled graph, so plugins
  that import another plugin's contract fail with "Module not found" without
  it.

## Change the harness

1. Restart `mise run dev` after every edit; these packages do not hot reload.
2. Check a fresh home with `FATHOM_HOME=$(mktemp -d) mise run dev`, and the
   packaged app with `mise run desktop:build` when you touched `apps/desktop`
   or the server's file handling.
3. Update `docs/architecture.md` when a boundary or dependency direction moved.
