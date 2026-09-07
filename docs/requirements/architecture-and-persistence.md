# Architecture & Persistence Requirements

## 1. Agent Server Topology & Lifecycle

### Invariants

- The agent server is a headless, decoupled service containing the runtime,
  Cordis plugins, tool execution harness, and SQLite persistence.
- Client applications (Desktop WebView, Web browser, Mobile companion) are
  presentation and interaction layers that communicate with the server over
  network protocols.

### Process Modes

1. **Managed Child Process (Desktop Default)**:
   - When the Fathom desktop app launches, it probes for an existing daemon
     (`localhost:4040` or `~/.fathom/fathom.sock`).
   - If active, it attaches immediately; if not, the desktop app spawns the
     local agent server as a background child process and manages its lifecycle.
   - Tied to desktop app lifecycle with clean SIGTERM shutdown.
2. **Standalone Daemon (`fathom server`)**:
   - Can be run headlessly from the CLI on local or remote developer
     machines/VMs.
   - Accepts client connections authenticated via local token or pairing code.

---

## 2. Client-Server Transport & Communication

### Invariants

- Communication between clients (Desktop UI, Web UI) and the Agent Server uses a
  full-duplex **WebSocket** connection.
- Upstream AI provider protocols (HTTPS/SSE) are completely decoupled from
  client transport. Clients never handle provider API keys or direct provider
  streaming.
- Remote mobile companion and external tunneling are deferred to a post-v1
  roadmap milestone. Initial focus is strictly local Desktop and Web over local
  WebSocket.

### Protocol Features

- **Bidirectional Streaming**: Low-latency token streaming, thinking tokens, and
  tool status events streamed downstream to client.
- **Mid-Turn Interruption & Steering**: Clients send instantaneous abort signals
  and queued steering messages upstream over the same socket.
- **Heartbeat & Resumption**: Client reconnects smoothly replay missed events or
  re-sync active state from the server.

---

## 3. Database Topology & Storage Layout

To prevent monolithic database lock contention, corruption blast radius, and
repository pollution, databases are centrally managed under `~/.fathom/` rather
than placed inside user git repositories.

### Directory Structure

```text
~/.fathom/
├── global.db                   # Global registry, auth references, app settings
├── projects/
│   └── <project-hash>/         # SHA-256 hash or deterministic slug of absolute project path
│       ├── sessions.db         # Isolated SQLite database for this project's sessions & branches
│       └── shadow.git/         # Isolated Git repository tracking workspace tree snapshots
```

### Database Responsibilities

- **`global.db`**:
  - Registered projects table (`id`, `canonical_path`, `display_name`,
    `created_at`, `last_opened_at`).
  - Global app configurations & provider auth references (keys/tokens stored
    safely).
- **`<project-hash>/sessions.db`**:
  - Project session trees and branches (`messages`, `tree_nodes`,
    `tool_events`).
  - Isolated WAL and checkpointing per project so heavy agent runs never degrade
    other projects.
  - Zero disk pollution inside the user's workspace (no git ignores required).

---

## 4. Session Tree & Persistence Schema

### Session Tree Architecture

- **Node Structure**: Every message/turn is a node containing:
  - `id`: Unique UUID / ULID.
  - `parent_id`: Parent node ID (null for conversation root).
  - `session_id`: Logical project session container.
  - `role`: `user` | `assistant` | `tool` | `system`.
  - `content`: Text, structured reasoning/thinking, or tool call payloads.
  - `status`: `pending` | `completed` | `interrupted` | `error`.
  - `snapshot_tree_id`: Optional Git tree hash for workspace restoration.
  - `created_at`: Timestamp.
- **Tree Topology**: History is modeled strictly as an arborescence (a directed
  tree with parent pointers, similar to Git commits without merge commits).
  Every node has at most one parent (`parent_id`), guaranteeing an unambiguous
  linear history from any leaf to root with zero multi-parent merge complexity.
- **Permanent Branch Retention**: All branches are retained permanently in
  SQLite. Rewinding to a previous turn and continuing creates a new branch;
  prior branches remain intact and navigable via tree leaf pointers.
- **Head Pointer**: Active timeline is determined by following parent pointers
  from the current `active_leaf_id` up to the root node.

### Streaming Persistence & Crash Recovery

- **Real-Time Delivery**: Raw token deltas stream directly to clients over the
  full-duplex WebSocket connection for instant rendering.
- **Periodic Checkpointing**: Server buffers incoming tokens in memory and
  commits atomic `UPDATE` writes to the active SQLite node every 2 seconds, as
  well as immediately on tool dispatch and turn completion.

### Time Travel, Branch Summaries & Git Workspace Snapshots

- **Rewind Granularity**: Time travel is strictly bounded to **User and
  Assistant message boundaries**. Warping back to mid-step tool calls is
  disallowed to prevent half-executed side effects and fragmented state.
- **Three Branch Summary Modes**:
  1. **Standard Summary**: Automatically synthesizes a concise recap of
     learnings, attempted strategies, and failure modes from the abandoned
     branch and pins it to the new branch tip.
  2. **Custom Prompt Summary**: Allows the user to provide a targeted focus
     directive (e.g. _"Focus only on why the migration script failed"_).
  3. **No Summary**: Complete clean-slate rewind with zero context carryover
     from the abandoned branch.
- **Git-Backed Workspace Snapshots**:
  - **Prompt-Submission Timing**: A lightweight workspace tree snapshot is
    captured immediately upon **User Prompt submission** (as the user message
    node is committed to SQLite), before any tool or model execution starts.
    This guarantees that rewinding to that prompt restores the exact clean state
    of the workspace before the agent touched anything.
  - **Universal Shadow Git (`~/.fathom/projects/<hash>/shadow.git`)**:
    - Operates with `--work-tree=<workspace>`.
    - Completely decoupled from the project's native `.git` (if present). Never
      interferes with user branches, commits, or staging indexes, and provides
      100% universal snapshotting even for non-git folders.
  - **Content Deduplication & Zero Disk Bloat**:
    - Snapshots execute via fast plumbing (`git write-tree`).
    - If no workspace files have changed since the last turn, `git write-tree`
      returns the exact same tree SHA in milliseconds without writing new
      objects. In SQLite, the user node merely records `snapshot_tree_id`.
    - If files changed, Git only stores blobs for the specific modified files.
  - **Reversion Confirmation**:
    - Reverting files presents a clear, direct confirmation dialog: _"Reverting
      to this point will undo all workspace file changes made since this turn.
      Continue?"_
- **Snapshot Retention & Graceful Degradation**:
  - File snapshots can be pruned via user storage management to reclaim disk
    space.
  - If a snapshot has been deleted, conversation tree rewinds continue to
    function normally; only the file reversion toggle is disabled.

### Subagents as First-Class Child Sessions

Rather than building a separate, bespoke subagent runtime or detached worker
infrastructure, subagents in Fathom are modeled as first-class child `Session`
entities:

- **Schema Relationship**: Represented directly in the SQLite `sessions` table
  with a `parent_session_id` reference.
- **Inherited Primitives**: Child sessions automatically inherit SQLite WAL
  persistence, session tree branching, token metrics, cost tracking, tool
  sandboxing, and crash recovery with zero special-case logic.
- **Aggregated Cost & Observability**: Parent sessions aggregate token usage and
  dollar cost from all descendant child sessions into their primary telemetry
  meter.
- **Specialized Roles (e.g. `web_research`)**: Specialized capabilities (such as
  web research in `plugin-web`) execute inside an isolated child session
  container, preventing exploratory browsing noise from cluttering the primary
  session's transcript, and returning only distilled findings to the parent.

### Git Worktree Isolation & Parallel Workspaces

To prevent long-running or autonomous agent runs from clobbering active files in
the developer's main editor:

- **Isolated Worktree Provisioning**:
  - Agent runs or child sessions can be provisioned inside dedicated Git
    worktrees (`.fathom/worktrees/<task-id>` or configured path).
  - Uses native `git worktree add` to branch from the current HEAD without
    duplicating repository history or object storage.
- **Non-Destructive Parallel Execution**:
  - The agent works, edits files, compiles, runs tests, and installs package
    dependencies completely isolated from the developer's working directory.
- **Settlement & Merge Lifecycle**:
  - Once the task settles, the developer can review changes, cherry-pick or
    merge the worktree branch into main, switch active Monaco editor to the
    worktree, or discard/prune the worktree cleanly via `git worktree remove`.

---

## 5. Execution Model: Pragmatic "Database as Truth" (Accept Then Drive)

Fathom adopts the core resiliency principles of Pi's runtime (server-driven
loop, durable intent first, crash-safe transcripts) while discarding the
distributed-systems complexity (heavy Operation Machine tables, Lane Snapshot
replay buffers) in favor of SQLite WAL-native atomic transactions and a unified
WebSocket connection.

### 5.1 Accept Then Drive

1. **Atomic Intent Write**: When a user submits a prompt, the server writes the
   `user` message node to SQLite within an immediate transaction **before**
   calling any provider API or initiating tool execution.
2. **Decoupled Backend Driver**: The agent loop runs as a server-managed async
   task in memory. The client is strictly an observer; closing a tab, reloading
   a browser, or losing network connectivity never terminates or orphans the
   running agent task.

### 5.2 Zero-Engine Disconnect & Resumption

- Reconnection does not rely on complex event-replay queues or distributed state
  synchronization.
- When a client reconnects:
  1. It fetches `GET /sessions/:id/messages` (or requests it over socket) to
     render the durable transcript truth from SQLite.
  2. The client sends `{ type: "session:attach", sessionId }` over the
     WebSocket. If the server signals `isRunning: true`, live streaming frames
     resume seamlessly over the existing socket.

### 5.3 Crash Reconciliation

- If the server process dies abruptly mid-execution (power loss, SIGKILL, OOM),
  recovery does not require a complex boot-time scan of job locks.
- **On-Demand Session Check**: When a session is loaded, Fathom validates the
  tip of the active branch:
  - The session tree history is restored to a valid state instantly with zero
    corrupted context passed to future model turns.

### 5.4 Mid-Run Ingestion (Steer vs. Follow-up)

When a user submits input while an agent run is actively in-flight
(`isRunning: true`), the message is ingested without hard aborting the session:

1. **`steer` (Active Redirection)**:
   - Injected immediately into the active run after the currently executing tool
     finishes.
   - Appended to the transcript as a user message node, allowing the model to
     pivot its trajectory on the very next model step.
   - **Default Action**: Pressing Enter during an active run triggers `steer` by
     default.
2. **`follow_up` (Queued Work)**:
   - Enqueued in memory for the active session.
   - Held until the current run settles into `idle`, at which point it
     automatically commits to SQLite and triggers the subsequent run.

**Configuration & UI**:

- **Configurable Default**: Users can configure their preferred default
  submission mode (`steer` vs. `follow_up`) in session/app settings.
- **Mid-Run Input Controls**: When typing while a run is in-flight, the input
  bar exposes distinct action triggers (e.g. dual buttons or shortcut toggle)
  allowing the user to explicitly dispatch either a Steer or a Follow-up on
  demand.

### 5.5 Runtime Retry Wait

Separate from low-level network/HTTP retries handled inside the model SDK
(`pi-ai`), the agent loop manages extended provider rate limits (HTTP 429),
temporary capacity constraints (HTTP 503), or network dropouts via a visible
`retry_waiting` state:

- **Backoff Policy**: Automatic exponential backoff with jitter up to a maximum
  of **5 attempts**.
- **No Disruption to Controls**: The global Stop/Abort button remains fully
  accessible throughout the wait duration.
- **Steer Interruption**: Submitting a steer message while in a backoff wait
  cancels the remaining timer delay immediately, appends the steer input, and
  dispatches the next step.

### 5.6 Clean Aborts & Seamless Continuation ([Continue])

To prevent transcript corruption and enable effortless recovery from mid-run
interruptions:

- **Strict Tool Integrity (No Orphaned Calls)**: Upstream APIs reject
  transcripts where an assistant `tool_call` has no corresponding `tool_result`.
  When a run is aborted while a tool is executing (or queued), the runtime
  immediately kills any child process and commits a synthetic `ToolResult` to
  SQLite: `{ status: "aborted", content: "Tool execution cancelled by user." }`.
- **Intact Transcript Guarantee**: Because every step and tool call is cleanly
  closed, the SQLite transcript remains structurally valid at all times.
- **Seamless Resumption ([Continue])**: When a run halts due to an abort or
  recoverable error, the runtime exposes a resume operation. Invoking `continue`
  drives the agent loop directly from the current transcript head without
  requiring new user prompt text.
