# Integration Prototype

The user authorized a combined prototype, including shared editor/agent LSP
diagnostics. This does not close technical planning or authorize a production
build. Work lives in `prototype-integration/`, copied from the Solid prototype.

## Scope

- Keep the Cordis host, Solid shell, and pi-ai model adapter.
- Persist and restore conversations with Drizzle and `node:sqlite`.
- Render streamed Markdown with markdown-it and Shiki.
- Add Monaco and one Deno LSP connection shared with agent diagnostic tools.
- Connect MCP tools over stdio and Streamable HTTP; expose them to scripts.
- Run approved scripts in child processes with user access.
- Add xterm.js and pty-ffi, including resizing and cleanup.
- Build and exercise the desktop bundle, not only the browser build.

## Progress

- [x] Copy the Solid prototype without generated files or local credentials.
- [x] Connect backend services and persistence.
- [x] Connect editor, diagnostics, terminal, and script controls.
- [x] Exercise one connected workflow and restart recovery.
- [x] Build the native app and record packaging evidence.
- [x] Record gaps and exact verification limits.

Use small files by responsibility. Reuse existing styles. Start with a local MCP
fixture and temporary workspace so checks need no external account or paid model
call. Keep the real model path available for interactive use.

## Evidence

The combined smoke workflow passed on macOS ARM64 with Deno 2.9.6:

- A real Deno LSP type error reaches the agent diagnostic tool.
- An agent-tool edit clears diagnostics and saves the file.
- Unsaved Monaco text reaches the same agent diagnostic store. An agent-tool fix
  clears the editor markers. Monaco's own TypeScript checker is not used.
- Local stdio and Streamable HTTP MCP discovery and calls work.
- An approved Deno script calls MCP through the server bridge. A Python script
  runs, is patched by ID, and runs again after approval.
- PTY shell output and the requested row/column resize are observed.
- Drizzle generates and applies a migration; a conversation survives a restart.
- Solid renders Markdown and Shiki output without uncaught browser errors.

The CEF desktop bundle builds and launches. Its backend successfully uses the
embedded migration and PTY library, runs the host Deno LSP, and launches the
included MCP fixture. Native UI interaction was not automated; browser UI
interaction was checked with Playwright. No paid model calls were made.

## Gaps Found

- Deno's dependency-age policy rejected TypeBox 1.3.28. The user approved using
  the previous patch; this prototype pins **1.3.27**, without bypassing the
  policy.
- Monaco 0.56.0 changed package export paths and language registration paths.
  The prototype uses its current exports rather than older documentation paths.
- vscode-jsonrpc 9.0.2 requires its exported `/node` path, not `/node.js`.
- Native packaging must include PTY binaries and SQL migrations explicitly. An
  embedded MCP fixture must be materialized before an external interpreter can
  run it. The host still needs Deno installed for LSP and script execution.
- The planned semantic approval gate, per-tool script types, full crash
  reconciliation, remote MCP authentication, and process-tree cleanup need
  further work. See the prototype README for deliberate scope limits.

Exact prototype pins are in `prototype-integration/deno.json` and its lockfile.
Drizzle ORM and Kit use **1.0.0-rc.4**. Bundled TypeScript is **6.0.3**. These
results inform planning; they do not make the prototype production-ready.
