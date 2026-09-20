# Fathom baseline

The baseline ends when a local plugin author can add backend and browser behavior
through the public SDK, then configure, disable, enable, and reload it without
editing the kernel or either host. The existing provider workbench exercises those
connections. Sessions, tools, approvals, and the agent loop each get a later plan.

## Status

Established as the browser development foundation. The local SDK authoring workflow
is documented in [plugin authoring](../plugin-authoring.md). Installation changes
require a host restart; existing entries support explicit live reload.

Manual checks covered an external backend/UI plugin, typed API events and SQLite
persistence, nested source and CSS rebuilds, workspace recovery, dependency blocking
and restoration, configuration rejection, activation rollback with handoff, lease
drain, replay-gap reset, and persisted UI enablement. The imported design folder
matches all 202 files on `deno-desktop`. No test suite or validation scripts were added.

The [remediation](baseline-remediation.md#implementation-status) moves feature
contracts and implementations into their plugins, simplifies scoped authoring,
and removes unused baseline code. Saved OpenAI and xAI connections and live
streamed requests were verified after those changes.

## Ownership

| Layer | Responsibility |
| --- | --- |
| SDK | Service and registry tokens, plugin definitions, schemas, typed API definitions, transport helpers, UI slots and controls |
| Kernel | Dependency graph, scopes, staged contributions, leases, serialized changes, status, rollback, and handoff |
| Deno host | Startup, manifest discovery, trusted local sources, fresh module loading, persisted composition, API bridge, events, assets, and management endpoints |
| Browser host | Authenticated client, shared Solid runtime, artifact/CSS loading, local kernel, UI lifecycle, and recovery controls |
| Plugins | Replaceable feature implementations and contributions |

The HTTP listener is a host transport. It carries requests to the API bridge;
feature plugins contribute typed handlers and events. Backend management endpoints remain available when feature plugins are disabled.
The browser host keeps a small recovery surface outside the workspace so disabled
or failed UI entries can be restored. The plugin manager owns the full management UI.

Plugins execute with their host's privileges. Adding an external directory is an
explicit trust decision. The baseline never automatically imports project code,
executes package install scripts, or claims a sandbox.

## Contracts

`defineService<T>` describes one provider. `defineRegistry<E>` describes one owner
with multiple contributors. Plugins declare every dependency in `requires` and
every owned capability in `provides`. The kernel supplies owned registries and
checks the returned service keys. Host-owned registries use the same scoped
registration and lease implementation. Services can be consumer-scope factories;
API publication and storage use that scope instead of asking authors for their id.

Registrations accept local ids; the kernel prefixes the contributing plugin id.
Keyed registries use typed key functions, direct lookup, and disposable leases.
Registrations sort by order, then id.
Contributions become visible only after startup succeeds. A failed startup cleans
up its scope. Registry leases pin their contributor for admitted work. Reload
closes admission, drains work, aborts remaining work, and disposes consumers before
providers. Unsettled cleanup prevents replacement and reports restart required.

Candidate modules and configuration are checked before stopping the current
implementation. Failed activation restores the previous implementation. Validated
data handoff supports state preservation; live service objects do not survive a
reload. Operations have ids and observable completion or failure.

Both hosts register source intent with the kernel, which loads definitions and
reports import failures as failed plugin states. The browser uses the same kernel. Backend API advertisements supply browser service
availability. Removing an API blocks its UI consumers; restoring it starts them
again. UI contributions have error boundaries, and a host recovery surface remains
outside replaceable workspace roots.

## Existing plugins

| Plugin | Baseline scope |
| --- | --- |
| storage | SQLite implementation of the storage contract; consumers see namespaced JSON values |
| credentials | Login registry, private credential persistence, refresh and connection UI |
| llm | Provider behavior registry, live model discovery, streaming service, and model workbench UI |
| provider-openai | API-key, ChatGPT callback/device login, Responses protocol |
| provider-anthropic | API-key and browser/code login, Messages protocol |
| provider-xai | API-key and device login, Responses protocol |
| workspace | Minimal replaceable shell with panel slots |
| plugin-manager | Optional management UI over the host's management services |

Design tokens and reusable controls belong to the SDK UI foundation. The imported
`design/` directory is the visual reference. Dedicated theme, settings, commands,
and other plugins should be introduced when they own replaceable behavior, rather
than just to give every module a plugin label.

## Author workflow

A plugin directory has `deno.json` with a `fathom` property declaring its plugin ID,
SDK compatibility, and backend and/or browser source entries. Package version and
exports use the normal Deno fields.
Both entries use `@fathom/sdk`; UI code also uses `@fathom/sdk/ui` and the host's
Solid singletons. Shared contracts live inside the plugin or in a contracts package.

The SDK exports `bundleUi(pluginDir)` to compile one plugin and externalize the
singletons. The host discovers plugins and writes content-addressed UI assets. Backend reload copies source
to a fresh generation directory so nested relative imports receive new identities.
Named contract packages and SDK dependencies retain their identities; changing shared SDK code requires
an application restart. Obsolete backend source generations are removed once
activation and persistence finish; rollback retains the previous source until then.

The local install command registers an explicitly trusted plugin directory. It does
not publish, download, or run installation hooks. Composition records desired
configuration and enablement separately for backend and browser entries. External
plugin development uses explicit rebuild and reload commands in this baseline.

## Completion checks

Validate manually, without adding test suites or validation scripts:

- Start the application and restore saved provider connections.
- Load a plugin from outside the repository through public SDK imports.
- Register a typed API, event, storage value, and browser panel.
- Inspect both hosts' dependencies, contributions, states, and operation results.
- Disable and restore backend and UI entries independently, including workspace and
  plugin-manager, while keeping host recovery available.
- Reload a nested backend edit and a rebuilt UI artifact; preserve valid handoff.
- Reject invalid configuration and restore a last-good plugin after startup fails.
- Drain a leased contribution before cleanup; refuse new admission while stopping.
- Reconnect the event stream and refresh authoritative state after a replay gap.
- Restart and restore desired composition and plugin data.

## Work after the baseline

Each feature starts with its own plan, contract, ownership boundary, failure
behavior, and manual acceptance checks. Implement and validate one at a time.
See [plugin roadmap](plugins/README.md) for the sequence.

Deferred foundation extensions include automatic file watching, remote installation,
marketplace/update flows, SDK publication, full design-system component coverage,
and packaged native desktop transport. The browser development host is the baseline
application. They are separate deliverables with their own plans.
