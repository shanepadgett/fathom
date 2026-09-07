# Fathom Integration Prototype

A combined Solid/Deno Desktop prototype. Cordis owns the backend services.
Monaco and agent tools share one Deno LSP document store. Drizzle persists
conversations. MCP, scripts, Markdown highlighting, and an interactive terminal
run in the same app.

## Run

Requires Deno **2.9.6** on PATH. The native app also uses that installed Deno
for LSP, Deno scripts, and the local MCP fixture. Set `FATHOM_DENO` to its
absolute path if needed. Python, Node, and Bash scripts need those interpreters.

From `prototype-integration/`:

```sh
FATHOM_WORKSPACE="$PWD/examples" FATHOM_PROFILE=echo deno task start
```

Open <http://127.0.0.1:4317>. Click **Open file** to load `issues.ts`. It contains
a deliberate type error. Use a disposable workspace when trying agent edits.

`echo` makes no model calls. Omit `FATHOM_PROFILE=echo` to use the real pi-ai
adapter and existing `~/.pi/agent/auth.json` credentials. `FATHOM_MODEL` selects
the model; the inherited default is `gpt-5.6-luna`. This integration run did not
make paid model calls or verify account access to that model.

## Try the connected workflow

- Open `issues.ts`. Both Monaco and **Read diagnostics as agent** show the LSP
  error. Unsaved editor changes also reach that same service.
- With a live model, click **Ask agent to fix**. The `editor_read`,
  `editor_edit`, and `diagnostics` tools share the editor's versioned buffer.
- Start the shell. Drag the divider or use its arrow keys to resize panels;
  the terminal resizes with its container. Stop the shell when done.
- Expand **MCP and scripts**, connect the local fixture, and call `greet`.
  Approve the call in the bench. Run the sample Deno script to call that tool
  through `fathom:mcp`; approve both the script and its MCP call.
- Send a conversation message, quit, and reopen with the same workspace.
  The conversation returns from SQLite.

To try HTTP MCP, run this in another terminal and connect its URL in the bench:

```sh
deno serve -A --host 127.0.0.1 --port 4330 examples/mcp-http.ts
```

The endpoint is `http://127.0.0.1:4330/mcp`. It is a local fixture, not a hosted
service. Other MCP endpoints can be entered in the same field.

## Native app

```sh
deno task desktop
FATHOM_WORKSPACE="$PWD/examples" FATHOM_PROFILE=echo \
  ./dist/Fathom.app/Contents/MacOS/laufey
```

The build downloads the pinned PTY native library and includes it, UI assets,
migrations, and the MCP fixture. The native runtime selects its own local
port. This is an unsigned-for-distribution macOS development bundle.

## Verification

```sh
deno task verify
deno run -A scripts/native-smoke.ts
```

`verify` builds the UI, checks types, and runs the combined smoke workflow in
a temporary workspace with Playwright Chromium. The native check requires a
completed desktop build and opens its window. Neither makes paid model calls.
If Chromium is missing, install it with
`deno run -A npm:playwright@1.58.2 install chromium`.

The scripts approve only their known local fixtures. The interactive app does
not auto-approve scripts. See [evidence and gaps](../docs/technical/integration-prototype.md).

## Layout and storage

`src/integration/` contains separate LSP, MCP, terminal, approval, script,
storage, and integration-plugin files. `src/plugins/` retains the model adapter
and agent loop. `ui-src/components/` contains editor, terminal, and Markdown
adapters. `ui/`, `native/`, and `dist/` are generated and ignored.

Conversations default to `~/.fathom/prototype-integration/sessions.db`, keyed
by workspace. Override with `FATHOM_DB`. Scripts are saved under
`~/.fathom/prototype-integration/scratch/`; script IDs support patching during
the current process. Drizzle Kit generates reviewed SQL with
`deno task migrations`; the app applies shipped migrations on startup.

## Limits

- This is a trusted, local integration bench, not the production security model.
  Scripts and MCP calls use explicit approval rather than the planned LLM gate.
  Existing file/bash tools retain the original prototype's user access.
- One active conversation per workspace. No branch tree, global/project database
  split, compaction, or complete crash reconciliation. An interrupted run is
  marked cancelled; a clean restart is the verified recovery case.
- Deno TypeScript diagnostics only. No completion, rename, or other LSP features.
  Dirty buffers reject ordinary write/edit tools; versioned `editor_edit` handles
  them. External edits refresh clean buffers; save rejects disk conflicts.
- One MCP connection. No OAuth UI, reconnect policy, or deferred tool activation.
  Script MCP methods use a generic typed facade, not generated per-tool types.
- One terminal. PTY close is exercised, but termination of arbitrary descendant
  process trees is not proven. Script cancellation uses Unix process groups.
- Polling transports and whole-snapshot persistence favor proof over performance.
  No large-transcript or high-output benchmarks. The custom Markdown renderer
  remains deferred.
- Runtime switching is disabled to avoid overlapping persistence/service owners.
  Inherited comparison tests and custom-composition examples are not the combined
  prototype's verification entry point; use the commands above.
