# Desktop agent runtime prototype

macOS proof of concept for the owned Fathom runtime boundary. It uses official Deno Desktop, Pi's
low-level `Agent`, OpenAI Codex through existing Pi OAuth credentials, SQLite session storage,
workspace-confined file tools, and reloadable backend and Web Component extensions.

## Run

Requirements:

- Deno `2.9.4` through repository Mise configuration
- a current `openai-codex` OAuth entry in `~/.pi/agent/auth.json`

```sh
mise exec -- deno task --cwd spikes/desktop-agent check
mise exec -- deno task --cwd spikes/desktop-agent verify
mise exec -- deno task --cwd spikes/desktop-agent dev
```

`dev` opens the bundled fixture workspace and listens for Chrome DevTools Protocol on
`127.0.0.1:9230`. CEF is intentional: Deno Desktop's system WebView backend does not expose the
renderer through unified DevTools.

To run against another workspace:

```sh
cd spikes/desktop-agent
FATHOM_DATA_DIR=.data mise exec -- deno desktop --backend=cef -A main.ts /absolute/workspace
```

Pi credentials are read directly, rejected when the file is a symlink or has group/world access, and
never copied, logged, refreshed, or changed. Refresh near-expiry credentials through Pi.

## Prototype flow

1. Send a prompt and watch the normalized Pi message stream.
2. Ask agent to read `README.md` or create a file in fixture workspace.
3. Existing-file writes pause for explicit approval.
4. Close and reopen app; selected linear session resumes from SQLite.
5. Toggle **Workspace kit**, then click **Reload extensions** or enter `/reload`.
6. Extension adds `workspace_stats`, `/workspace-stats`, custom tool blocks, and replacement
   composer.
7. Change `shared.ts`; reload proves a transitive backend import is replaced with worker generation.

Extension toggles and file changes only mark reload pending. Reload is refused during active run.
Backend reload replaces complete Deno worker. Renderer reload navigates complete webview document,
discarding executable extension module graph while preserving draft text and selected session.

## Browser automation

Deno Desktop 2.9.4 exposes ordinary CDP discovery for CEF. `agent-browser` supports existing CDP
targets, so expected development flow is:

```sh
npx --yes agent-browser@0.33.2 --cdp 9230 snapshot
npx --yes agent-browser@0.33.2 --cdp 9230 screenshot
```

The dependency is version-pinned in these commands and is not part of runtime. If port discovery
selects Deno worker target instead of renderer page, inspect `http://127.0.0.1:9230/json/list` and
pass renderer WebSocket URL to `--cdp`.

## Intentional ceiling

One workspace and one active linear session. No compaction, branches, exact stream recovery,
multi-window coordination, extension sandbox, stable public API, rich patch tool, or production
credential ownership. `verify.ts` is one narrow executable check rather than a unit-test suite.
