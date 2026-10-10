# Plugin packages

Status: the definition and provider split is done. Milestone 1, local
plugins in the shipped app with Hex dependencies, is built and verified.
Next: installing plugins from Hex and git. How people write their own
plugins, share them, and build on each other's plugins, as in Pi and
DeepSeek Harness.

## Milestone 1: local plugins in the shipped app (built)

Write a plugin in `~/.fathom/plugins/<name>/`, press Reload, and see it live in
`Fathom.app`. How it works is in [architecture](../architecture.md#local-plugins);
how to write one is in the [guide](../guides/write-a-plugin.md).

### Verified on the packaged app (2026-10-10)

Run from `Fathom.app` with a fresh home and only the system `PATH`, driven
through the UI:

| Scenario | Result |
| --- | --- |
| First launch | Window ready in 0.5 s; Hex installed, ~40 host packages fetched, Tailwind downloaded and checksummed, two plugins built and running at 7.1 s. |
| Hex deps | `slugify`, `ex_keccak` (precompiled Rust NIF), `jason` (resolved to the shipped copy) all called from a plugin view. |
| Protocols | A plugin's `Jason.Encoder` implementation dispatches through the host's consolidated protocol. |
| Live edit | View text changed on screen 2.1 s after the build; same page, same process, generation unchanged. |
| CSS | Arbitrary classes (`bg-[#00ff88]`, `rotate-3`) and Phosphor icons in plugin code apply live. |
| Manifest change | Restart brings up the new contribution. Since replaced by one Reload that builds and restarts. |
| Syntax error | File and line under Local plugins; previous build keeps running; fix recovers. |
| Compiler warning | Listed per plugin with file and line. |
| Host conflict (`req ~> 0.4.0`) | Hex's explanation on that plugin; others unaffected. |
| Crash on start | "Failed: boom on purpose"; header shows it; the next build restarts it. |
| Delete a plugin folder | Plugin stops and leaves the list; code unloaded. |
| New plugin button | Generated, built, and running in 2.3 s. |
| App restart | All local plugins back 3.3 s after launch. |

Decisions:

- Tailwind downloads on the first local plugin build, pinned to the host's
  version and checked against the published SHA-256.
- A release step strips debug info from every module except consolidated
  protocols. The release stays at 43 MB; the app is 49 MB.
- Phosphor's regular icons (1,248 SVGs) ship in the SDK's `priv`, so plugin
  CSS can use `ph-*` classes.
- The SDK's CSS and the icon plugin live in `packages/fathom_sdk/priv/css`.
- Settings › Plugins has no per-row Reload. Restart appears on failed
  plugins.
- No automatic builds on file changes: an editor or agent may still be
  writing. The watcher lists changed plugins; the header shows
  "N plugins changed · Reload", which builds, applies, and restarts plugins
  whose manifest changed. Fathom builds on its own only at launch and after
  New plugin. A plugin creation studio, once the agent runtime exists, will
  decide when to reload from the agent's own work.

Limits, in order of likely need:

- Each build pays for a VM start, `deps.get`, and Tailwind: about 2 s. Skip
  `deps.get` when no `mix.exs` changed, and keep a warm builder node.
- Local plugins cannot ship JavaScript hooks (colocated or otherwise).
- Libraries a removed plugin brought stay loaded until Fathom restarts.
- A local plugin cannot replace a bundled plugin with the same id.
- Project plugins (`<project>/.fathom/plugins/`) wait for a project concept
  and a trust prompt.
- Windows: the builder command and Tailwind target exist, but nothing has
  run there.

### Proven on the release (`bin/fathom eval`, 2026-10-10)

| Check | Result |
| --- | --- |
| Plugin outside the repo, no deps | Compiles with `Kernel.ParallelCompiler` against the release's SDK, LiveView, EEx: 0.7 s, no warnings. Loads with `:application.load/1` from a generated spec; manifest reads. |
| Mix and Hex in the release | `mix: :load, inets: :load` in the release. Mix installs Hex 2.5.1 and rebar3 into a Fathom-owned `MIX_HOME`. |
| Hex deps resolve against the host | A workspace project pins every Hex library the release ships with `== vsn` (from the host lockfile, intersected with the release's apps). Fathom's own libraries are path stand-ins (`override: true, compile: false, app: false`). |
| Pure Elixir dep (`slugify`) | Compiled and called. |
| Precompiled Rust NIF (`ex_keccak`) | `rustler_precompiled` downloaded `nif-2.16-aarch64-apple-darwin`; NIF loaded and ran. |
| Dep the host ships (`jason`) | Resolved to the pinned 1.4.5; at run time the release's copy is used, no second copy. |
| Conflict (`req ~> 0.4.0` vs shipped 0.7.5) | Hex refuses: "depends on req ~> 0.4.0 … depends on req 0.7.5, version solving failed." |
| Full build, warm cache | 1.0–1.5 s including VM start. |
| Plugin CSS | Tailwind over the plugin's sources with the SDK theme: 37 ms, its classes resolve to Fathom tokens. |
| File watching | `file_system` as a real dependency; `mac_listener` ships in the release and delivers events. |
| Plugin protocol implementations | Invisible to consolidated protocols until re-consolidated. Re-consolidation at load needs the consolidated module's debug info; the release keeps it there only. |

Builder rules the prototype established:

- The builder runs as its own OS process (`bin/fathom eval` in a release,
  `elixir` with the host's code paths in development), so Mix's global state
  and compile crashes never touch the running app.
- It purges the release's consolidated protocols first, or Hex's own protocol
  implementations fail.
- The workspace sets `prune_code_paths: false`; dependencies inherit it, so
  plugins compile against the release's libraries.
- Only libraries the host does not ship are compiled (`deps.compile <new>`);
  only their `ebin` paths are loaded into the app.

## Agreed

| Decision | Detail |
| --- | --- |
| Registry is Hex. | Plugins are Hex packages named `fathom_*`, tagged `fathom-plugin`. Sources: `hex:name@req`, `git:url@ref`, a local path. No Fathom index yet. |
| Install compiles on the user's machine. | The app ships Mix and fetches Hex and Tailwind on first use. BEAM bytecode is the same on every OS, so only native code is platform-specific. |
| One resolution for everything installed. | The BEAM loads one version of a module, so all installed plugins resolve together, with the host's libraries pinned. A conflict fails the install with Hex's explanation instead of failing at run time. |
| Definition, provider, consumer. | Swappable capabilities are split into a definition package and provider plugins. Consumers depend on the definition only. |

## Definition, provider, consumer

DeepSeek Harness uses the same split on Cordis: `dsh-attachment` declares the
abstract `AttachmentStore` service and its types and depends only on Cordis;
`dsh-attachment-local` implements it on disk; consumers name the
`attachments` service and never import the implementation.

| Role | Fathom shape | Depends on | Runs processes |
| --- | --- | --- | --- |
| Definition | Library package. `use Fathom.Service` contract module (behaviour + client functions), its structs and types, registry tokens, provider behaviours, pure helpers shared by providers. | `fathom_sdk` | No. Not a plugin; the kernel never sees it. |
| Provider | Plugin. Implements the behaviour, `provides:` the token. | Definition | Yes |
| Consumer | Plugin. Calls the definition's client functions, `requires:` the token. | Definition | Its own |

The definition's version is the contract version. A breaking change to a
callback, struct, or message is a major release; providers and consumers say
`~> 1.0` and Hex keeps them compatible.

The definition takes the plain name; providers take a descriptive suffix.
The bundled plugins are split this way:

| Was | Definition | Provider |
| --- | --- | --- |
| `llm` plugin | `fathom_llm`: `FathomLlm`, `FathomLlm.Provider`, `FathomLlm.Providers`, `FathomLlm.Protocols.*` | `fathom_llm_router`: credential resolution, checks, diagnostics view |
| `credentials` plugin | `fathom_credentials`: `FathomCredentials`, `Credential`, `LoginFlow`, `Logins`, `OAuth`, `DeviceCode`, `LoginUI` | `fathom_credentials_local`: `auth.json` store, refresh, login sessions, providers view |
| `storage` plugin | stays in `fathom_sdk` as `Fathom.Storage` | `fathom_storage_sqlite` |

Provider plugins for OpenAI, Anthropic, and xAI already have the right shape:
they depend on the two definitions and contribute to their registries.

## Native code

NIFs run inside the BEAM: fastest, and a crash in one stops Fathom. Ports run
as a separate OS process: a crash ends only that process.

| Need | Use |
| --- | --- |
| Short, hot calls (fuzzy matching, parsing, hashing) | A Rust NIF through Rustler with `rustler_precompiled`, which downloads the built library for the platform and NIF version, so users need no compiler. Work over about 1 ms runs on a dirty scheduler. |
| Long-running or crash-prone work (indexers, language servers, watchers) | A port: a bundled binary spoken to over stdio, supervised like any process. |
| A library that must not share Fathom's node | A peer-node plugin, from the [Elixir harness plan](elixir-harness.md). |

The install screen lists packages with native code. Fathom publishes its OTP
version so authors know which NIF version to build.

## Milestone 2: install from Hex and git

Installed plugins join the local plugin workspace instead of getting their
own, so one resolution covers everything:

```text
~/.fathom/plugins.json   adds "source": "hex:fathom_foo@~> 1.0" or "git:url@ref" per installed id
~/.fathom/build/workspace/mix.exs
  local plugins          path deps, as now
  installed plugins      hex or git deps, from plugins.json
  host libraries         pinned to the shipped versions, as now
```

Install: add the source, build, and the kernel starts the plugin as it does a
new local one. Upgrade: change the requirement and build; a running plugin
whose manifest changed becomes stale. Bundled plugins ship precompiled at
fixed versions; an installed or local plugin with the same id takes their
place once the kernel allows it.

## Open

- Bundles: a package that lists plugins and default configuration, like
  DeepSeek's bundles and profiles. Not needed until there are third-party sets.
- The install and upgrade UI in the plugin manager, and how Fathom finds
  plugins on Hex (the `fathom-plugin` tag).
