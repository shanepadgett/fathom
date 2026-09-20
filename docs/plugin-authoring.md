# Developing a local plugin

Run commands from the Fathom checkout. This baseline uses local packages and a
browser host. SDK publication and native packaging have separate plans.

Follow the module ownership rules in [AGENTS.md](../AGENTS.md). Keep plugin entries
limited to dependency declarations and registration. Put each named component in
its own file, keep component styles beside it, and give stateful behavior a named
module. The existing credentials and LLM plugins demonstrate these boundaries.

Use `mise run fmt` to format code, `mise run lint` to lint it, and
`mise run lint:fix` to apply safe lint fixes. `mise run check` runs the formatting
check, linter, and Deno type checker. `mise run fmt:check` and
`mise run typecheck` also work individually.

Oxlint and Oxfmt versions are pinned in `deno.json` and run through Deno. Oxfmt
owns source formatting: 80 columns, two spaces, and preserved multiline objects.
Use braces for control flow, separate variable declarations, and simple
conditionals instead of nested ternaries. Use descriptive names and blank lines
between logical steps. Formatting alone cannot establish those boundaries.

Solid rules apply to TSX. The reactivity rule recognizes the host's `subscribe`,
`onReset`, and `watch` callbacks, which read current state when events arrive.
Deno remains the type checker; Oxlint's TypeScript Go integration is not enabled.
The copied `design/` tree, docs, generated output, and local agent files are outside
the source formatting scope.

A plugin directory contains `deno.json` and a backend entry, a UI entry, or both.
Fathom reads the `fathom` property alongside the normal Deno package fields:

```json
{
  "version": "0.1.0",
  "fathom": {
    "id": "example",
    "sdk": "^0.1",
    "backend": "backend/mod.ts",
    "ui": "ui/mod.tsx"
  }
}
```

Only plugins that export a public contract need a Deno package `name` and
`exports`. The `fathom.id` identifies the plugin independently.

Both entries are source files. Import `./styles.css` from the UI entry to include
its stylesheet. The `fathom.styles` property can also list stylesheet paths. The
browser host loads and removes those styles with the plugin. Keep feature selectors inside a plugin root
class so they don't change other panels.

Keep relative imports inside the plugin directory. Acquire resources in `start`
and release them through `scope.defer`; avoid effects at module top level.

```sh
deno task plugin:add /absolute/path/to/example
deno task dev
```

Registration trusts that directory to execute with host privileges. It downloads
nothing and runs no installation hooks. Restart after adding or removing a plugin.
New external entries start disabled. Open **Plugin runtime** to enable their backend
and UI entries separately. **Plugin recovery** can re-enable disabled UI entries
or retry failed UI entries even when the workspace or plugin manager is unavailable.

For backend edits, click **Reload**. Nested local modules receive fresh identities.
For UI edits, run `deno task build:ui`, then reload the UI entry. A page refresh
also loads the current artifacts. Shared contract or SDK changes require restarting
the host and refreshing the page using its new launch URL.

```sh
deno task plugin:remove /absolute/path/to/example
```

`FATHOM_HOME` selects composition, registrations, artifacts, and storage (default
`~/.fathom`). `FATHOM_PORT` selects the loopback port (default 5173).

## Own and export your contracts

Use `definePlugin`, `defineService`, `defineRegistry`, `defineApi`, `T`, `query`,
`command`, and `event` from `@fathom/sdk`. Feature contracts belong to their
plugins. A shared contract used by other plugins gets a named package. Add
`exports` to the same `deno.json`:

```json
{
  "name": "@example/feature",
  "version": "0.1.0",
  "exports": { "./contract": "./contract.ts" },
  "fathom": {
    "id": "example",
    "sdk": "^0.1",
    "backend": "backend/mod.ts",
    "ui": "ui/mod.tsx"
  }
}
```

Add an internal package to the root `deno.json` workspace. For a local external
contract package, add its public specifier to the active Deno import map:

```json
{
  "imports": {
    "@example/feature/contract": "file:///absolute/path/to/example/contract.ts"
  }
}
```

Consumers import that name. Cross-plugin relative imports break when the backend
loader copies a plugin directory. Contracts contain token definitions and schemas,
with no runtime resources; token identity is its string id, including when a UI
bundle inlines its own copy.

Existing exports are `@fathom/credentials/contract`, `@fathom/llm/contract`, and
`@fathom/workspace/contract`. Generic OAuth helpers live at
`@fathom/credentials/oauth`; optional shared model protocol adapters live at
`@fathom/llm/protocols`. A provider contributes `models(credential, signal)` and
`stream(input, credential, signal)` behavior to `Providers`. New protocols require
no SDK changes.

## Publish behavior through your scope

Declare dependencies in `requires` and capabilities in `provides`. The kernel
supplies registry implementations. Return exactly your declared service keys from
`start`.

```ts
import { Api, definePlugin, Storage } from "@fathom/sdk";
import { FeatureApi } from "@example/feature/contract";

export default definePlugin({
  id: "example",
  requires: { api: Api, storage: Storage },
  start({ use }) {
    const publication = use.api.serve(FeatureApi, {
      read: () => ({ count: Number(use.storage.get("count") ?? 0) }),
      increment: () => {
        const count = Number(use.storage.get("count") ?? 0) + 1;
        use.storage.set("count", count);
        publication.emit("changed", { count });
        return {};
      },
    });
  },
});
```

This example assumes `FeatureApi` declares `read`, `increment`, and `changed`
with matching schemas. Serving validates inputs, outputs, and emitted payloads.
The host owns registration cleanup; call `publication.dispose()` only to withdraw
an API early. Each request leases its contributor until the handler settles.

Storage is already scoped to the consuming plugin id. Its public methods are
`get(key)`, `set(key, value)`, and `delete(key)`; values are JSON. The current
implementation uses SQLite. Each feature owns its formats and migration policy.

A service can be a shared object or a synchronous factory receiving the consumer
scope. For example, the storage plugin returns
`{ storage: (consumer) => namespaceFor(consumer.id) }`. The kernel invokes the
factory once for each requiring key during consumer startup. Function values are
factories; wrap callable service behavior in an object. Hosts use the same form
with `kernel.provide(token, scope => value)`.

## Registries and lifecycle

Use `defineRegistry<EntryType>("example.entries", { key: entry => entry.id })` for
a keyed registry. Add contributions with local names:
`use.entries.add(value, { id: "provider" })` becomes `example/provider`.
Local ids must be nonempty and contain no slash. Keys must be nonempty strings;
duplicates, including staged contributions, are rejected.

`get(key)` returns an entry. `lease(key)` admits work and pins the contributor:

```ts
using lease = use.entries.lease(providerId);
if (!lease) throw new Error("Provider unavailable");
await lease.value.run(AbortSignal.any([signal, lease.signal]));
```

Unkeyed registries look up and lease by full entry id. Leases also expose an
idempotent `release()` for lifetimes that cross a lexical scope. Registry additions
and watchers automatically clean up with the consuming scope.

Use `scope.task` for background work and honor cancellation. Configuration is
validated before stopping the active plugin. Use `scope.handoff(schema, producer)`
and the plugin's `handoff` schema for serializable reload state. The kernel captures
handoff after admitted work settles and before cleanup. Failed activation restores
the previous definition, configuration, and handoff. Unsettled cleanup reports
restart required. Obsolete backend generations are removed once rollback no longer
needs them.

## Browser UI

Import Solid from `solid-js`; import `Client`, `Slot`, `defineSlot`, `Button`,
`Input`, and `Panel` from `@fathom/sdk/ui`. Import `WorkspacePanels` from
`@fathom/workspace/contract`. The host supplies one Solid and SDK runtime. Plugins
never import kernel or host implementation files.

Require an API token to receive its typed client. Backend advertisements control
availability: withdrawing an API blocks its UI consumers; restoring it starts them.
Clean up event subscriptions with the component. `Client` exposes `api`,
`connection`, and `onReset`; use reset callbacks to query authoritative state
after a replay gap. Events provide bounded replay rather than durable history.

The separate `KernelControl` service has async `plugins`, `graph`, `operations`,
and `submit` methods plus `watch`. It combines local and backend management.
The plugin manager owns the full management UI.

Contribute panels with stable local ids. Slots contain render failures and order
visible entries by host settings, entry order, then id. The `Slots` host service
holds those settings; the host renderer supplies them through Solid context.
There is no slot settings editor or single-contributor slot API yet.

The host includes `design/tokens.css` and SDK control styles. Use semantic variables
such as `--color-canvas`, `--color-ink`, `--color-action`, and `--color-line`.
The complete design directory is the visual reference; the SDK implements only the
initial control set.

## Build and validate

`bundleUi(pluginDir)` from `@fathom/sdk/build` compiles one plugin to
`{ js: Uint8Array, css: string }`. It uses the active Deno workspace/import map for
local contract packages and leaves host runtimes external. The Deno host's
`build:ui` task discovers plugins, calls that function, and writes content-addressed
assets alongside the shell.

Manually exercise enable, disable, reload, invalid configuration, failed startup,
cleanup, and restart persistence for each plugin. Inspect both hosts' state,
dependencies, contributions, and operation results in **Plugin runtime**.

The [baseline plan](plans/baseline.md) defines the boundary. The
[plugin roadmap](plans/plugins/README.md) defines the next planning sequence.
Sessions, tools, approvals, and the agent loop each need their own plan.
