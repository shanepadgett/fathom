# SDK

`@fathom/sdk` is the one published package. Every other package is internal.

## Surface

| Export | Runs in | Contains |
| --- | --- | --- |
| `.` | both | plugin definition, tokens, schemas, API and storage contracts, environment, composition |
| `./ui` | page | slot registries, `Slot`, `Client`, `Appearance`, controls |
| `./schema` | both | TypeBox re-export |

Stylesheets are files under `src/ui/theme/` located relative to the `./ui`
entry. JSR exports are modules only; do not export CSS.

## Rules

- Implementations import defining modules directly. Public exports stay in
  `src/mod.ts`, `src/ui/mod.ts`, and `src/ui/controls/mod.ts`, which are
  export-only.
- Every export has explicit types. `no-slow-types` is on for this package and
  `mise run publish:check` must pass, apart from the license.
- Keep published types precise. Do not widen a schema or contract to satisfy a
  check.
- Public exports carry a `/** */` comment when the type does not explain usage,
  errors, or cleanup.
- No build toolchain in the SDK. esbuild, Babel, PostCSS, and Tailwind live in
  `scripts/bundling/`. `ui-artifact.ts` owns the runtime import list shared by
  the page and every plugin: `solid-js`, `solid-js/web`, `solid-js/store`,
  `@fathom/sdk`, `@fathom/sdk/ui`.
- Tokens match by string id. Never compare tokens by object identity.
- `scope` and `handoff` are reserved start-context keys. Adding a reserved key
  means updating `ReservedKeys`, the kernel's definition check, and
  `docs/concepts.md`.

## Change the SDK

1. Edit under `packages/sdk/src/`. Add new exports to the relevant barrel.
2. Restart `mise run dev`; the SDK does not hot reload.
3. Run `mise run check` and `mise run publish:check`.
4. Removing or renaming an export is a breaking change. Update every bundled
   plugin, `examples/counter`, the scaffold in `scripts/new-plugin.ts`, and the
   guides that show it.
