# Repository Guidelines

## Project Structure & Module Organization

This is a plugin baseline for a future agent harness. Keep sessions, tools,
approvals, and agent execution in their individual plugin plans. The provider
workbench is a bounded manual check, not the future conversation interface.

The SDK defines contracts and UI primitives. The kernel owns serialized lifecycle
changes and rollback. Hosts load plugins and connect them to their environment.
Features and provider-specific behavior belong in plugins.

- Package `mod.ts` files are export-only. Plugin `backend/mod.ts` and `ui/mod.tsx`
  files declare dependencies and wire named implementations; don't add feature
  logic or whole views there.
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
- `mise run lint:deno`: Deno lint and JSR public-type checks.
- `mise run check`: formatting, both linters, and Deno type checking.
- `deno task build:ui`: compile the application and plugin UIs.
- `deno task dev`: build and launch the browser host.

For baseline work, use these checks and manual runtime validation. Don't add
tests or custom validation scripts unless requested. SDK changes require a host
restart and browser refresh. Never print saved credentials during validation.

## Standards

Read a standard only when its reason applies.

| Standard                                   | Reason to read                                    |
| ------------------------------------------ | ------------------------------------------------- |
| [TypeScript](docs/standards/typescript.md) | Before adding or updating TypeScript or TSX code. |

After code changes, run `mise run lint:fix`, then `mise run fmt`.
