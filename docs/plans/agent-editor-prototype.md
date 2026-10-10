# Agent and editor prototype

A working coding agent and code editor, to validate the whole prototype
before the production build-out. It folds roadmap items 1, 2, 4, 5, 6, and 7
(sessions, tools, coding tools, agent, conversation UI, composer) into a few
plugins, without the approvals plugin: tools run without asking, as in Pi.

## Systems

| System | Change | Owns |
| --- | --- | --- |
| `fathom_llm` (definition) | Expands | Conversations, tools, and tool calls in `stream/3` |
| `llm-router`, providers | Modified | Messages and Responses protocols with tool calls |
| `fathom_sdk` | Expands | `Fathom.Folder`: the folder the person works in, and "open this file" |
| `fathom_agent` (definition) | New | `FathomAgent` sessions contract, `FathomAgent.Tool`, `FathomAgent.Tools` |
| `agent` plugin | New | Sessions, the run loop, session files, the Chat page |
| `coding-tools` plugin | New | `read`, `write`, `edit`, `bash` contributed to `FathomAgent.Tools` |
| `editor` plugin | New | Editor dock: file tree, CodeMirror tabs, save, language servers |
| desktop shell | Modified | Native folder picker (`tauri-plugin-dialog`) |
| host assets | Expands | npm packages (CodeMirror) as host-shared JS libraries, like Jason for Elixir |

```text
Chat page ─ FathomAgent ─▶ agent: Session ─▶ Loop ─▶ FathomLlm.stream ─▶ provider
                                   │            └──▶ FathomAgent.Tools ─▶ coding-tools
                                   └─ events ─▶ Chat page
Fathom.Folder ◀── Chat page (pick, select session)   ──▶ editor dock (tree, open file)
```

## LLM contract

```elixir
@type tool :: %{name: String.t(), description: String.t(), parameters: map()} # JSON Schema
@type tool_call :: %{id: String.t(), name: String.t(), arguments: map()}
@type message ::
  %{role: :user, content: String.t()}
  | %{role: :assistant, content: [part], provider: String.t(), model: String.t(),
      native: term()}            # provider replay data, e.g. Responses output items
  | %{role: :tool_result, tool_call_id: String.t(), name: String.t(),
      content: String.t(), error: boolean()}
@type part :: %{type: :text, text: String.t()} | %{type: :tool_call} & tool_call
@type request :: %{provider:, model:, system: String.t() | nil, messages: [message],
                   tools: [tool]}   # `prompt:` still accepted: one user message

stream(request, reply_to, tag) :: {:ok, %{content: [part], stop: :stop | :tool_use | :length,
                                          native: term()}} | {:error, String.t()}
# reply_to gets {tag, {:text, s}}, {tag, {:thinking, s}}, {tag, {:tool_call, tool_call}}
```

- Responses (OpenAI, Codex, xAI): replay the provider's own output items when
  the next request goes to the same provider and model (keeps encrypted
  reasoning with `store: false`); otherwise convert from `content`.
- Messages (Anthropic): with a Claude sign-in, tool names go out in Claude
  Code's casing (`Read`, `Bash`) and come back as Fathom's (`ClaudeCode`).
- `Protocols.TextStream` becomes `Protocols.Stream`: a step function folds
  frames into the response and emits events.

## Agent

```elixir
# fathom_agent
FathomAgent.create(%{cwd:, provider:, model:}) :: {:ok, id}
FathomAgent.prompt(id, text) :: :ok | {:error, :running}
FathomAgent.abort(id) :: :ok
FathomAgent.sessions() :: [summary];  FathomAgent.session(id) :: session
FathomAgent.subscribe() / subscribe(id)   # {:agent_sessions, list} / {:agent, id, event}

@callback name/0, description/0, parameters/0
@callback run(args :: map(), %{cwd:, session:, call_id:}) ::
  {:ok, %{content: String.t(), details: map()}} | {:error, String.t()}
FathomAgent.Tools  # registry, value %{tool: module}
```

Call path: `ChatLive` → `FathomAgent.prompt` → `Session` (GenServer per
session, under a DynamicSupervisor) starts a `Loop` task. The loop calls
`FathomLlm.stream` with `reply_to: session`, so text arrives at the session,
which keeps the partial message and broadcasts. On `:tool_use` the loop runs
each call in order through the tool module, reporting `tool_start` and
`tool_end`, then streams again. Abort kills the loop task. Bash kills its OS
process when its port owner dies.

Session events: `{:status, :running | :idle}`, `{:text, s}`, `{:thinking, s}`,
`{:message, message}`, `{:tool_start, call}`, `{:tool_end, id, result}`,
`{:error, text}`. The session is written to `<home>/sessions/<id>.json` after
every message; sessions reload on start, and a run interrupted by a restart
gets error results for its unanswered tool calls.

Tools follow Pi's shapes: `read(path, offset?, limit?)` with 2000 lines /
50 KB truncation, `write(path, content)`, `edit(path, edits: [{oldText,
newText}])` with unique non-overlapping matches and a diff in `details`,
`bash(command, timeout?)` in the user's login shell (`$SHELL -l -c`) so
`PATH` matches a terminal, output truncated to the last 2000 lines / 50 KB.

## Editor

- Dock `editor`. Tree of `Fathom.Folder.current()`, lazily expanded, hiding
  `.git`, `_build`, `deps`, `node_modules`, `target`.
- One CodeMirror view in a colocated hook; one `EditorState` per open file.
  Save with ⌘S. Files changed on disk reload when clean and show a notice
  when dirty (the agent edits files while they are open).
- `Fathom.Folder.open_file(path, line)` opens the dock and the file, so tool
  cards link to the editor without knowing it exists.
- Language servers: Elixir `expert` (downloaded on first use to
  `<home>/tools`, checksum verified), TypeScript, Rust, and others found on
  the login-shell `PATH`. One port per folder and language; JSON-RPC relays
  through the LiveView to `@codemirror/lsp-client`.

## Built

As planned, plus:

- `FathomAgent.show/1` asks chat views to show a session; the browser's
  annotation tray has Send to agent, which starts a chat in the current
  folder on the last chosen model.
- `Fathom.Shell.env/0` strips Fathom's own environment from commands and
  language servers. `Fathom.Folder.real/1` resolves symbolic links.
- The editor answers `client/registerCapability` and similar requests itself
  and sends `didSave` / `didChangeWatchedFiles`; Expert waits on the first
  and rebuilds only on the others.
- Fixed on the way: expired OAuth tokens never refreshed in development
  (`function_exported?/3` on a module not loaded yet).

## Checked

In the development desktop app, driven over RPC:

| Check | Result |
| --- | --- |
| Tool calls with Anthropic (sign-in), OpenAI (Codex), xAI | Multi-step runs with read, edit, bash on all three |
| Switching provider mid-session | GPT read Claude's earlier turns correctly |
| Stop during `sleep 47` | Process killed; call closed; record valid |
| Kill the node mid-run, restart | Sessions reload; open call answered |
| Streaming bash output, running state, Stop, markdown | Screenshots |
| Agent edits a file open in the editor | Editor reloads; diagnostics refresh |
| Expert in a Mix project | Downloaded, checksum verified; diagnostics shown; completion answered |
| Annotation prompt to an agent | The model named the HEEx source file and line |

Not checked by hand (clicks cannot be scripted here): typing in the
composer, the folder picker, model switching from the select, Copy for
agent, Send to agent's button, editor typing, ⌘S, hover and completion
popups, closing a dirty tab, and anything in the packaged app beyond launch.
