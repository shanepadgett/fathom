# Tools & Execution Requirements

## 1. Tool Taxonomy & Execution Model

The execution harness provides distinct tools optimized for interactive coding,
system operations, and automated debugging.

---

## 2. File Operations Suite (`read`, `write`, `edit`)

### 2.1 File Reader (`read`)

- **Windowing & Limits**: Reads up to 3,000 lines per call. If a file exceeds
  3,000 lines, returns the chunk with pagination instructions indicating how to
  request the next chunk from line $N$.
- **Contextual Hashlines (3-Character Prefix)**:
  - Lines omit visual line numbers to eliminate token waste and indentation
    noise.
  - Every line is prefixed with a unique 3-character Base62 hash:

    ```text
    7aK| export function add(a: number, b: number) {
    8bL|   return a + b;
    9cM| }
    ```

  - **Contextual Generation**: Generated via
    `hash(line_index, content_checksum)`. Ensures identical lines (such as `}`
    or blank lines) each receive unique hashline tags.
  - **Conflict Detection**: Encodes a content checksum to detect external
    modifications made in the embedded code editor before an edit is applied.

### 2.2 File Creator & Overwriter (`write`)

- **Purpose**: Creating new files or full file replacements.
- **Atomic Writes**: Writes to a temporary staging file before atomically
  renaming to target path, preventing corrupted or truncated files if process is
  interrupted.

### 2.3 Hashline Editor (`edit`)

The edit tool operates on hashline anchors rather than error-prone line numbers
or fragile string matching.

- **Operations**:
  1. **`replace`**:
     - Parameters: `start_hash`, `end_hash` (optional for single line),
       `content`.
     - Drop-in replacement of the specified span.
  2. **`insert_before`**:
     - Parameters: `anchor_hash`, `content`.
     - Inserts content immediately above the anchor (ideal for imports, types,
       or decorators without quoting surrounding code).
  3. **`insert_after`**:
     - Parameters: `anchor_hash`, `content`.
     - Inserts content immediately below the anchor (ideal for appending
       functions, methods, or variants).
  4. **`delete`**:
     - Parameters: `start_hash`, `end_hash` (optional for single line).
     - Removes the specified line span cleanly with no replacement payload.
- **Safety Checks**: Validates that target hashline content checksums match
  current disk state. Aborts if the file was modified since the last read.

---

## 3. Command Runner (`bash`)

- **Purpose**: Direct invocation of single-line CLI commands, build tools,
  package managers, test runners, and git operations.
- **Requirements**:
  - **Process Isolation**: Executes in the context of the active workspace
    directory.
  - **Process Group Termination**: When aborted or timed out, terminates the
    entire process group (avoiding orphaned background processes).
  - **Streaming Output**: Stdout and stderr stream directly to the client UI.
  - **Configurable Timeout**: Default execution timeout with explicit extension
    parameters for long-running builds.
  - **Background Execution (`background?: boolean`)**:
    - `background: false` (default): Executes synchronously, streams output to
      the client, and returns terminal exit status upon completion.
    - `background: true`: Allocates a pseudo-terminal (PTY), launches the
      process as a long-lived background job, waits an initial grace period
      (e.g. 1.5s) to capture boot output or immediate startup failures, and
      returns `{ ptyId, status: "running", initialOutput }`.
  - **Unbounded Output Guardrails**: The tool schema and description explicitly
    instruct the model to cap potentially unbounded terminal output (e.g. using
    `| head -n 50`, `--limit`, or redirecting verbose build logs to
    `~/.fathom/scratch/`) to protect the transcript from noise and context
    overflow.

---

## 4. Script & Patch Engine (`script`)

- **Purpose**: Authoring, executing, inspecting, and iteratively patching
  multi-line scripts across multiple programming runtimes without monolithic
  command rewrites.
- **Bounded Script Output Guardrails**: Tool instructions command the agent to
  filter, aggregate, and slice data inside the script runtime before writing to
  stdout, returning only concise, actionable summaries to the transcript.

### Interpreter & Runtime Discovery

- On server startup or session initialization, the server detects installed host
  interpreters and their versions:
  - Examples: `deno`, `bun`, `node`, `python3`, `perl`, `bash`, `ruby`, `sh`.
- The detected runtime catalog and active versions are exposed dynamically in
  the tool parameters / system prompt.

### Execution & Scratch Lifecycle

1. **Script Persistence**: Scripts are stored in an isolated session scratch
   space (`~/.fathom/scratch/<session-id>/<script-name>.<ext>`) and associated
   with the active session branch.
2. **Execution**: The tool executes the script using the chosen runtime
   interpreter with standard timeouts and signal handling.
3. **Structured Output**: Returns exit code, execution duration, formatted
   stdout, and stderr.
4. **Iterative Patching**: If the script errors or outputs incorrect data, the
   agent can call `script` in `patch` mode to apply targeted text replacements
   or edits to the existing script rather than re-generating the entire code
   payload.

---

## 5. Background PTY Manager (`pty`)

- **Purpose**: Managing, inspecting, and controlling long-running background
  processes spawned by `bash(background: true)`.
- **Operations**:
  1. **`list`**: Lists all active background PTY sessions, displaying process
     names, PID, session uptime, and status.
  2. **`read`**: Reads recent terminal buffer lines (tail) from the specified
     PTY session (e.g. `lines?: 50`), filtering ANSI escape codes or preserving
     them for UI terminal rendering.
  3. **`write`**: Sends text or keystrokes directly into the PTY's `stdin`
     (essential for interactive confirmation prompts, REPLs, or menu
     selections).
  4. **`kill`**: Sends signals (`SIGTERM` or `SIGKILL`) to terminate the PTY
     process and its entire process tree cleanly.
- **Session Lifecycle & Cleanup**:
  - Background PTYs are owned by the active project session.
  - When a project session closes or the server daemon shuts down, the harness
    cleanly sends `SIGTERM` followed by `SIGKILL` to all child process groups,
    preventing orphaned background daemons.

---

## 6. Command & Script Approval Pipeline

To eliminate approval fatigue while maintaining rigorous safety, command and
script execution requests pass through a structured 3-stage pipeline:

### Stage 1: User Hard Deny (Zero Built-ins, Zero LLM)

- **Purely User-Configured**: Fathom ships with zero hardcoded deny rules out of
  the box.
- Developers configure their own glob or regex patterns (globally or per-repo)
  for commands they strictly forbid.
- If a command matches a user deny rule, it is rejected immediately with zero
  LLM overhead.

### Stage 2: Deterministic Safe Allow List (Instant Execution)

- **Default Safe Commands**: Ships with a curated set of known safe inspection
  and read-only commands (`git status`, `git diff`, `git log`, `ls`, `cat`,
  `grep`, `pwd`, `cargo check`, linters, read-only tools).
- **Pipe & Compound Matching**: Safely evaluates chained commands using pipes
  (`|`) and logical operators (`&&`) when all segments match safe patterns (e.g.
  `git status --short | grep M && echo "done"`).
- **User Extensible**: Developers can register additional custom commands or
  globs they consider safe to run within their workspace.
- **Bash Only**: Safe allow matching applies to `bash` commands; the `script`
  tool always proceeds to Stage 3 for semantic inspection.
- If matched, executes instantly with zero added latency.

### Stage 3: LLM Verification Gate (Intent-Aware)

Any `bash` command outside the allow/deny lists, as well as **all** `script`
executions, are routed to the LLM Verification Gate:

- **User Intent Context**: The gate receives the proposed command or script
  payload along with the **latest user prompt** as context to evaluate whether
  the action aligns with what the user actually requested.
- **Script Tool Invariant**: The multi-line `script` runner **always** undergoes
  LLM verification to inspect the code payload before execution.
- **Two Possible Outcomes**:
  1. **Auto-Approve**: If the LLM confirms the operation is safe and aligned
     with user intent (non-destructive, normal workspace alterations within
     scope), execution proceeds automatically.
  2. **Escalate to User**: If the operation touches sensitive or potentially
     risky state (databases, cloud credentials like `~/.aws`, home directories,
     destructive deletions, or ambiguous side effects), the LLM generates a
     concise, plain-English explanation detailing:
     - Exactly what the command or script will do.
     - What local or external state will be modified or executed.
     - Execution halts and presents this explanation to the user for explicit
       approval or rejection.

---

## 7. Deferred Tool Loading, Tool Search & Scripted MCP

### 7.1 Baseline vs. Deferred Tool Taxonomy

To eliminate prompt context bloat and preserve model tool-selection accuracy
across growing tool catalogs:

- **Baseline Set (Always Present in Context)**:
  - `read`, `write`, `edit`, `bash`, `script`, `pty`.
- **Deferred Catalog (Held in Harness Registry)**:
  - **Unified Web Package (`plugin-web`)**: Combines `search_web`, `read_url`,
    and `web_research` (subagent) into a single plugin package, loaded
    on-demand.
  - **Multi-Modal Generation**: `generate_image` (conditional on provider
    support).
  - **Skills Workflows**: Custom workflows and task-specific skills.

### 7.2 100% Harness-Level Tool Catalog & Search (`search_tools`)

- **Universal Provider Independence**:
  - Rather than transmitting hundreds of serialized tool definitions over the
    wire using fragmented provider-specific flags (e.g. Anthropic
    `defer_loading` vs. OpenAI `tool_search`), Fathom manages deferred tool
    discovery **100% within the local harness**.
  - Upstream API requests (Anthropic, OpenAI, Gemini, Grok, local models) only
    ever receive the baseline tool suite plus a single, universal `search_tools`
    tool.
  - Eliminates network payload bloat, token leakage, and vendor-specific gateway
    adapters.
- **Local Search Engine (BM25 / SQLite FTS5)**:
  - Fathom indexes deferred tools, skills, and plugin extensions using a local
    BM25 or SQLite FTS5 index over names, namespaces, descriptions, and tags.
  - When the model calls `search_tools(query)` (e.g.
    `search_tools("generate image")` or `search_tools("fetch web page")`),
    Fathom retrieves the matching tool definitions and dynamically injects their
    full schemas into the active run's toolset for subsequent steps.

### 7.3 Dual-Paradigm MCP Support (Direct Tools & Scripted "Code Mode")

Fathom supports two complementary paradigms for interacting with Model Context
Protocol (MCP) servers:

1. **Direct MCP Tools (Discoverable via `search_tools`)**:
   - Connected MCP tools are indexed in Fathom's harness-level Tool Catalog.
   - When needed for single-shot operations (e.g. looking up a single issue,
     fetching a weather report, or querying an external database), the agent
     activates the tool via `search_tools` and invokes it as a standard tool
     call.
2. **Scripted MCP ("Code Mode" Execution)**:
   - For high-volume operations, data aggregation, or chained multi-step
     workflows, MCP servers are exposed as typed modules inside the `script`
     runner (`import { github, jira } from "fathom:mcp"`).
   - The agent writes concise scripts to paginate APIs, filter JSON payloads,
     and aggregate data locally before returning a distilled summary.
   - Eliminates prompt context bloat and multi-turn latency for bulk tasks (e.g.
     searching 50 issues and correlating them runs in a single script turn).

---

## 8. Tool Checkpoints & Concurrency Pipeline

When a model response emits multiple tool calls in a single step (e.g. parallel
reads, edits, and terminal executions):

### 8.1 Tool Checkpoints (Atomic Settlement)

- **Per-Tool Atomic Commits**: Each individual `ToolRun` writes its completed
  `ToolResult` directly to SQLite the exact millisecond it finishes.
- **Crash Re-Execution Prevention**:
  - In the event of a system crash, process OOM, or sudden power interruption
    mid-step, already-completed side effects are preserved in SQLite.
  - On restart, crash reconciliation never re-runs completed tool calls
    (preventing destructive double-edits or duplicate commands).
  - The in-flight tool call that was interrupted receives a synthetic status:
    `{ status: "aborted", content: "Interrupted by system shutdown." }`.
  - The transcript remains 100% structurally intact, allowing the user to
    seamlessly hit `[Continue]`.

### 8.2 Adaptive Execution Concurrency

- **Execution Setting**: Configurable via session/app settings
  (`toolExecution`): `"sequential" | "parallel" | "adaptive"`.
- **Adaptive Execution (Default)**:
  - **Concurrent Parallel**: Read-only tools (`read`, `search_tools`,
    `pty(action: "read")`, `pty(action: "list")`) execute concurrently via
    `Promise.all` for maximum throughput.
  - **Strict Sequential**: Mutating and side-effect tools (`write`, `edit`,
    `bash`, `script`, `pty(action: "write")`, `pty(action: "kill")`) execute
    sequentially in declared order to eliminate race conditions and corrupted
    disk state.

---

## 9. Tool Output Bounds & Disk Spooling

To prevent process out-of-memory (OOM) crashes, client UI frame drops, and
prompt context flooding when commands emit massive outputs:

### 9.1 In-Memory Threshold & Scratch Spooling

- **Threshold Limit**: Process stdout/stderr output streams into a rolling
  memory buffer up to a strict cap of **100 KB** (~2,000 lines).
- **Disk Spooling**: When output crosses the 100 KB threshold, the runtime
  ceases accumulating in memory and transparently streams all subsequent output
  to a scratch file on disk:
  `~/.fathom/scratch/<session-id>/output-<call-id>.log`.
- **Flat Memory Footprint**: Ensures server RAM usage remains flat and
  predictable regardless of command output volume.

### 9.2 Head + Tail Slicing for Model Context

The model and transcript receive a bounded, actionable representation:

- **Head**: The first 50 lines of output.
- **Spill Notice**:
  `[Output truncated: N lines (X MB) spilled to ~/.fathom/scratch/output-<id>.log. Use grep/read to inspect specific sections]`
- **Tail**: The last 50 lines of output (preserving terminal exit statuses,
  compiler error summaries, and test failure digests).

### 9.3 Full Log Inspection in UI

- The tool card in the transcript feed renders the head/tail preview along with
  an explicit **`[Open Full Log]`** action button.
- Clicking the button opens the spooled log file directly in the embedded Monaco
  editor for searching, scrolling, and debugging.

---

## 10. Active Tools (Per-Session Allowlist & Mode Scoping)

Rather than relying on model prompt compliance to prevent tool invocation,
Fathom provides deterministic, session-scoped tool filtering.

### 10.1 Session-Level Allowlist & Constraints

- **Dynamic Per-Session Configuration**: Users can constrain available tools at
  runtime:
  - **Read-Only Lock**: Restricts available tools to `read` and `search_tools`,
    completely disabling `write`, `edit`, `bash`, `script`, and `pty`.
  - **Terminal Lock**: Excludes `bash` and `pty` when terminal execution is
    unwanted, forcing all code modifications through validated hashline edits.
- **Hard Schema Omission**: Disallowed tools are physically stripped from the
  model request payload, guaranteeing the LLM cannot invoke them.

### 10.2 Integration with Modes & Personas (`plugin-modes`)

- Session modes apply predefined tool profiles:
  - **Planning Mode**: Disables mutating tools (`write`, `edit`, `bash`,
    `script`), allowing only discovery and artifact drafting.
  - **Reviewer Mode**: Constrains execution to reads, search, and LSP
    diagnostics.
  - **Architect Mode**: Restricts file modifications to markdown/plans while
    disallowing source code edits.

### 10.3 Catalog Filtering in `search_tools`

- When the agent invokes `search_tools(query)` to discover deferred tools, the
  local BM25/FTS5 search engine filters candidate tools against the active
  session allowlist.
- Disallowed tools are never surfaced in search results and cannot be
  dynamically activated into context.
