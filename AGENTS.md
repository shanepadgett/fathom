# Repository Guidelines

## Project Structure & Module Organization

This is a plugin baseline for a future agent harness. Keep sessions, tools,
approvals, and agent execution in their individual plugin plans. The provider
workbench is a bounded manual check, not the future conversation interface.

`@fathom/sdk` is the one published package: contracts and slot primitives at
its root, and tokens, fonts, icons, typography roles, and the shared controls
under `@fathom/sdk/ui`. The kernel owns serialized lifecycle changes and
rollback. The server (`packages/server`) is the Deno process that loads backend
plugins and serves the page; the renderer (`packages/renderer`) is the page
that loads UI plugins. `apps/desktop` is the only application: the native
window, its browser fallback, and the page it serves. Features and
provider-specific behavior belong in plugins. `examples/counter` is the plugin
the guides walk through. Read [architecture](docs/architecture.md) for the
boundary.

- Package `mod.ts` files are export-only. Plugin `backend/mod.ts` and `ui/mod.tsx`
  files declare dependencies and wire named implementations; don't add feature
  logic or whole views there.
- `packages/sdk/src/ui/controls` imports `solid-js` alone. Controls take props
  and children; they never import tokens, the client, the kernel, or a host,
  and they carry no fallback copy. Their stylesheets sit beside them and are
  imported by `src/ui/theme/styles.css`, never by the component.
- Put each named UI component in a matching PascalCase `.tsx` file. Keep its
  stylesheet beside it. Inline list items and registration callbacks are fine;
  don't collect independent components in a controls file.
- Name non-component modules for their responsibility. Don't introduce generic
  `utils`, `helpers`, `common`, or `types` collections. Colocate related types,
  schemas, and implementation; a separate file per type is unnecessary.
- Keep state ownership explicit. Login sessions own their pending replies;
  credential access owns refresh/removal coordination. Kernel dependency analysis
  and graph reporting are separate from the lifecycle transaction owner.
- Providers own authentication headers and endpoints. Protocol modules own wire
  formats. Share behavior without adding a central provider switch statement.
- SDK implementations import defining modules directly. Public exports stay in
  their barrels. The build compiler owns Solid transformation; `ui-artifact.ts`
  owns the shared runtime import list.

`design/` is the copied design reference. Don't reorganize or reformat it as part
of application cleanup. Archived plans are historical, not current instructions.

## Commands & Validation

- `mise run fmt` / `mise run fmt:check`: Oxfmt formatting and verification.
- `mise run lint` / `mise run lint:fix`: Oxlint checks and safe fixes.
- `mise run lint:deno`: Deno lint; JSR slow-type checks apply to the SDK only.
- `mise run check`: formatting, both linters, Deno type checking, and generated
  docs freshness.
- `mise run publish:check`: JSR publish dry run of the SDK.
- `deno task docs`: regenerate `docs/reference/sdk.md` and `plugins.md`.
- `deno task build:ui`: compile the page, runtimes, and plugin UIs into `dist/`.
- `deno task dev`: build, open the native window, rebuild and reload edited
  plugins. `deno task dev:browser` does the same in a browser tab for DevTools.
- `deno task new <id>`: scaffold a plugin under `plugins/`.
- `deno task desktop:build`: package `dist/Fathom.app`.

For baseline work, use these checks and manual runtime validation. Don't add
tests or custom validation scripts unless requested. SDK and kernel changes
require restarting `deno task dev`; plugin edits reload in place. Never print
saved credentials during validation. Use `FATHOM_HOME` to point a run at a
throwaway home directory.

## Standards

Read a standard only when its reason applies.

| Standard                                   | Reason to read                                    |
| ------------------------------------------ | ------------------------------------------------- |
| [TypeScript](docs/standards/typescript.md) | Before adding or updating TypeScript or TSX code. |

After code changes, run `mise run lint:fix`, then `mise run fmt`.
