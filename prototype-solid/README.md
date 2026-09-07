# Fathom Solid prototype

A Deno Desktop coding harness assembled from trusted plugins. Cordis owns
backend plugin lifecycles. pi-ai handles model requests and OAuth. Our code owns
the agent loop, context assembly, tool execution, session state, and UI
composition.

This is a UI comparison clone. The backend stays unchanged. See
[comparison notes](../docs/technical/ui-comparison.md) for findings and scope.

## Run

Requires Deno 2.9.6. Scaffolded with `deno init prototype`; packaged with the
native `deno desktop` CLI using the CEF backend.

From this folder:

```sh
deno task start
```

Open <http://127.0.0.1:4317>. For the native macOS app:

```sh
deno task desktop
FATHOM_WORKSPACE="$PWD" ./dist/Fathom.app/Contents/MacOS/laufey
```

The native runtime selects its own local port. The UI is embedded in the bundle;
the workspace is an ordinary directory on disk. Set `FATHOM_WORKSPACE`
explicitly when launching the executable. Finder launches use the process
working directory, which is not necessarily your project.

`deno task start`, `dev`, and `desktop` build the UI first. Edit `ui-src/`;
`ui/` is generated. For frontend edits, run `deno task watch:ui` in a second
terminal and refresh the page. `deno task dev` watches the backend only.
Changes to the desktop bundle require another build.

## Authentication and model

The model plugin reads `~/.pi/agent/auth.json`, using the existing
`openai-codex` login. Credentials remain outside the project and never enter the
frontend. Expired OAuth credentials refresh through pi-ai and update that same
file using pi-compatible file locking. No coding-agent or agent-core package is
imported.

The default is `gpt-5.6-luna`, verified with the current login. A catalog entry
does not guarantee account access: `gpt-5.4` was rejected by this account during
testing. Override the model with `FATHOM_MODEL`.

| Variable             | Default                   | Purpose                          |
| -------------------- | ------------------------- | -------------------------------- |
| `FATHOM_WORKSPACE`   | Process working directory | File and shell working directory |
| `FATHOM_PI_AUTH`     | `~/.pi/agent/auth.json`   | Existing pi credential store     |
| `FATHOM_MODEL`       | `gpt-5.6-luna`            | OpenAI Codex model identifier    |
| `FATHOM_PROFILE`     | `default`                 | `default` or `echo` composition  |
| `FATHOM_COMPOSITION` | Unset                     | External JSON composition path   |
| `FATHOM_PORT`        | `4317`                    | Browser development server port  |

## Composition proofs

The default UI can switch between our agent loop and an independent echo
runtime. Switching is allowed when idle and starts a fresh session. The echo
runtime never calls a model or tools.

Load an external backend tool and an external UI panel without rebuilding:

```sh
FATHOM_COMPOSITION="$PWD/examples/composition.json" \
FATHOM_WORKSPACE="$PWD" \
./dist/Fathom.app/Contents/MacOS/laufey
```

The composition adds `examples/clock-plugin.js` and
`examples/ui/session-inspector.js`. Ask the agent to use the clock tool. Both
files are loaded from disk after the app was compiled. UI modules can import
sibling files; the host serves their containing directory under a generated
extension URL.

For a complete UI replacement paired with the independent echo runtime, use
`examples/raw-composition.json` instead. That composition loads only the
external raw shell, with no bundled conversation, inspector, or shell plugins.

A custom composition is authoritative: it lists every backend and frontend
plugin. Edit it and restart to replace services or the entire UI shell. See
[plugin authoring](docs/plugins.md) and [frontend contracts](ui-src/README.md).

## Code map

```text
main.ts                    Small process entry point
src/contracts/             Application-owned model, session, context, tool types
src/kernel/                Plugin manifest and Cordis lifecycle adapter
src/host/                  Composition loading, run coordination, HTTP transport
src/plugins/model-pi/      Credential storage and pi-ai translation
src/plugins/runtime-agent/ Agent loop; no pi-ai dependency
src/plugins/tools/         Registry plus separate read/write/edit/bash plugins
src/plugins/               Session, context, workspace, echo, native window
ui-src/core/                   Frontend transport, state, plugin host
ui-src/plugins/                Replaceable shell, conversation, composition inspector
examples/                  External modules and a complete composition
scripts/                   Verification and opt-in live model smoke check
tests/                     Composition, runtime, transport, process behavior
```

## Verification

Run `deno task verify` explicitly for formatting, lint, Markdown lint, type
checks, and deterministic tests. Formatting may update files. Tests do not call
live models. No Git hooks are installed for this prototype.

```sh
deno task smoke
```

This opt-in check uses the existing login and makes real model requests. It
creates a temporary workspace, requires read/write/edit/bash, verifies the
edited file, checks runtime replacement, and removes the temporary workspace
afterward.

## Deliberate prototype limits

- One active session per process, stored in memory. Quitting, clearing, or
  switching compositions discards it. No persistence, crash recovery, or session
  migration.
- Text-only model context. Provider continuation data is opaque to the runtime
  and retained in memory for multi-turn requests; cross-adapter history
  migration is not implemented.
- Sixteen model steps per run, 4,096 output tokens per response, bounded tool
  output, and a 60-second bash timeout. No compaction or background job manager.
- Trusted in-process plugins. No plugin sandbox, permission prompts,
  marketplace, or installation manager. File paths may be absolute and are not
  sandboxed.
- Backend plugins use Cordis. The small frontend registry has its own browser
  lifecycle adapter; it does not bundle Cordis into the renderer.
- Local HTTP/JSON and SSE connect the UI to the runtime. Native bindings can
  replace that transport later. No remote-host support is claimed.
- macOS is the verified platform. The bash process-group implementation targets
  macOS/Linux; Windows needs a separate process implementation. Deno Desktop
  itself is experimental, and Cordis is pinned to a release candidate.
