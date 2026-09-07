# Frontend & User Experience Requirements

## 1. The Non-Separation Philosophy

Developers must never feel disconnected from their code while collaborating with
an AI agent. The user interface seamlessly pairs the interactive conversation
timeline with an integrated, full-featured code editor and diff engine.

---

## 2. Integrated Code Editor (Monaco Core)

- **Editor Engine**: Built on the **Monaco Editor** (the core editor powering VS
  Code).
- **Split Workspace Layout**:
  - **Left / Center**: Interactive agent conversation timeline, streaming
    thoughts, and tool executions.
  - **Right**: Active file viewer/editor, project breadcrumbs, and tabs.
- **Synchronized Navigation**:
  - When the agent performs a `read`, `write`, or `edit` operation, the editor
    automatically focuses the target file and smoothly highlights the affected
    lines and hashline anchors in real-time.
- **Diff Inspection & Manual Edits**:
  - Agent edits render using Monaco's native Diff Editor (inline or
    side-by-side) with green additions and red deletions.
  - Users can click into the editor to make manual modifications at any time.
  - Optimistic concurrency checks (hashlines) guarantee the agent never clobbers
    external or manual user edits.

---

## 3. Integrated Browser & Visual Annotations

To support full-stack web and native application workflows directly within the
development environment, Fathom embeds an interactive browser tab paired with a
visual annotation engine.

### Native WebView Surface

- **Native Desktop Integration**: Uses a native desktop webview instance rather
  than an HTML `<iframe>`, bypassing `X-Frame-Options` and CSP embedding
  restrictions.
- **Local Dev Server Pairing**: Automatically connects to local development
  servers spawned by `bash(background: true)` (e.g. `http://localhost:5173`)
  with automatic live-reload on agent file edits.
- **Tabbed / Split View**: Can be docked side-by-side with Monaco or toggled as
  an active workspace surface.

### Visual Annotation Overlay

- **Element & Area Selection**: Developers can click-and-drag rectangular
  bounding boxes around specific UI components or drop numbered pin callouts
  (`#1`, `#2`, `#3`).
- **Contextual Comments**: Each callout includes an inline text input to specify
  instructions, bug reports, or design critiques.
- **Element Inspection**: Automatically captures the underlying DOM hierarchy,
  CSS classes, and calculated bounding coordinates alongside the visual crop.

### Batched Annotation Staging Tray

- **Accumulated Feedback**: Annotations do not immediately dispatch single-turn
  messages. Instead, they collect in an **Annotation Tray** docked to the prompt
  input bar.
- **Multi-Point Submissions**: Users can browse across routes, pile up multiple
  UI fixes and visual notes, and submit them all at once as a unified,
  structured prompt.
- **Simulator & Canvas Support**: When domain plugins stream native application
  views (such as iOS Simulator screens) into the integrated browser, the exact
  same annotation overlay and batching tray operate natively on the streamed
  canvas.

---

## 4. Backend LSP Gateway & Self-Healing Loop

Language Server Protocol (LSP) intelligence is managed by a backend Cordis
`LspService` that serves both the human UI and the AI agent.

### Dual-Consumer Diagnostics

1. **Frontend Rendering (Monaco)**:
   - Diagnostics push to Monaco via `setModelMarkers()`.
   - Renders native red wavy squigglies (errors), yellow squigglies (warnings),
     hover popups with compiler explanations, and autocomplete dropdowns.
2. **Agent Self-Healing Loop**:
   - Before a `Run` completes (or during a `reviewer` step), the harness queries
     `LspService.getDiagnostics(modifiedFiles)`.
   - If compile or type errors exist, the harness automatically feeds them back
     to the agent as a review step:
     `"LSP reported 1 error in src/server.ts: [Error TS2322] ... Please resolve."`
   - The agent fixes syntax and type errors automatically before concluding.

### Community Language Plugins (Odin, Elixir, Rust, etc.)

- For languages not bundled with standard browser runtimes:
  - **Backend**: Plugin registers the local language server binary
    (`command: "ols"` for Odin, `command: "elixir-ls"` for Elixir,
    `command: "rust-analyzer"` for Rust).
  - **Frontend**: Plugin registers Monarch syntax highlighting tokens with
    Monaco.
  - **Graceful Fallback**: If the LSP binary is not installed on the user's
    host, the editor still provides full syntax highlighting and editing without
    error.

---

## 5. Extensible UI Shell & Command Palette

### Pluggable Transcript Entry Renderers (`registerEntryRenderer`)

- **Scoped Entry Presentation**: Plugins contribute presentation components
  matching specific transcript entries: message types, unified tool executions,
  thinking blocks, or custom session entries (e.g. interactive diff inspectors,
  rich image previews, test runners).
- **Unified Tool Execution Component**: Rather than splitting tool handling into
  disconnected renderers for calls versus results (as in append-only loggers),
  tool presentation is handled by a single unified component:
  - Receives the tool execution lifecycle state: `call` parameters, current
    execution `status` (`pending` | `running` | `completed` | `error` |
    `aborted`), settled `result` payload, and `durationMs`.
  - Manages the presentation seamlessly across in-flight execution and settled
    output without external state coordination.
- **Strict DOM Safety**: All web/desktop renderers use typed DOM structures with
  textContent or sanitized canvas/SVG elements, forbidding unescaped HTML
  interpolation.
- **Fallback Resolution**: The first matching renderer handles the presentation;
  unhandled blocks fall back to standard text/JSON presentation.

### Dockable Views & Surface Slots (`registerView`)

- Plugins contribute dockable views and panels across designated shell slots:
  - Sidebar panels (e.g. file explorer, git status, mode switcher).
  - Inspector rail tabs (e.g. runtime metrics, LSP diagnostics, MCP tool
    catalog).
  - **Background Terminals & Processes**: Dedicated panel rendering active PTY
    sessions with live terminal emulation (xterm), process status pills, user
    keystroke forwarding, and one-click process termination.
  - Status bar items and drawer views.

### Surface Overrides (`registerSurfaceOverride`)

- Following Fathom's "everything is a plugin" philosophy, experience packages
  can replace entire default surfaces (e.g. swapping the default Monaco editor
  for a specialized canvas, or replacing the transcript view with an alternative
  node graph visualizer).

### Global Command Palette (`Cmd+K` / `Ctrl+K`)

- Unified keyboard-first command surface.
- Automatically indexes all commands registered by plugins via
  `registerCommand()`.
- Quick-filter search for switching modes, triggering git operations, opening
  project files, and toggling inspector panels.

### Workspace Trust & Security Surface

- **First-Launch Trust Modal**:
  - Automatically triggered upon opening an unrecognized workspace directory.
  - Explains that project-local plugins (`.fathom/plugins/`) and custom
    execution scripts are blocked until trust is established.
  - Options: **`[Trust Workspace & Enable Plugins]`** |
    **`[Enter Restricted Mode]`**.
- **Restricted Mode Status Badge**:
  - When in Restricted Mode, the status bar renders a persistent warning badge
    (`⚠️ Restricted Mode`).
  - Clicking the badge re-opens the trust dialog, allowing the developer to
    grant trust at any time after inspecting the codebase.

---

## 6. Cost Tracking & Runtime Observability

Comprehensive telemetry is captured for every run and aggregated across sessions
to give developers complete transparency into inference expenditure and
performance.

### Per-Run Telemetry Metrics

- **Wall-Clock Time**: Execution latency from user input admission to final
  answer or tool completion.
- **Token Breakdown**: Explicit recording of prompt input tokens, completion
  output tokens, cache-read tokens, and cache-creation tokens.
- **Cache Hit Rate**: Percentage of the prompt served from provider-level prompt
  cache.
- **Throughput**: Real-time generation speed measured in tokens per second.
- **Dollar Cost**: Calculated accurately per step/run using
  `@earendil-works/pi-ai`'s native `calculateCost(model, usage)`.

### Aggregation & Persistence

- **Session Totals**: Running cumulative token usage and cost for the active
  session branch.
- **Daily Spend Rollup**: Persisted in SQLite for daily developer budgeting and
  quota alerts.
- **Monthly Cost Reports & Export**: Dedicated reporting surface aggregating
  expenditure across projects, models, and months. Supports printable summary
  views and CSV/JSON export for team budgeting.

### Observability Inspector (Tabbed Rail)

A dedicated inspector view surfaces live session telemetry:

- **Context Window Meter**: Visual gauge of active token count against model
  context limits.
- **Cache Efficiency**: Live cache hit ratios and savings.
- **System Health**: Active LSP language servers, background script runners, and
  loaded plugins.

---

## 7. Streaming Transcript & Density Controls

### 7.1 Real-Time Text & Scroll Detachment

- **Live Markdown Delta Streaming**: Text deltas stream directly into the
  transcript feed, incrementally rendering formatted markdown, tables, and code
  blocks.
- **Scroll Detachment Mechanics**:
  - The transcript viewport automatically scrolls to bottom while the user is
    anchored at the bottom of the feed.
  - If the user scrolls upward to inspect earlier messages or tool runs,
    auto-scrolling immediately **detaches** so the viewport does not jerk or
    fight user interaction.
  - A subtle "Jump to bottom" badge appears when detached, showing incoming
    message activity and re-anchoring when clicked (or when the user manually
    scrolls back to bottom).

### 7.2 Collapsible Thinking Blocks

- Streamed reasoning tokens render inside an expandable thinking accordion
  (`Thinking... (3.2s)`).
- Thinking blocks are expanded during active streaming to show live
  chain-of-thought, then automatically collapse into a compact summary on step
  completion (expandable on click).

### 7.3 Tool Execution Views & Resizable Previews

- **Expandable Tool Cards**: Each tool call displays its invocation arguments,
  execution duration, and output preview.
- **Bounded Height with Drag Handles**: Tool outputs render inside a bounded,
  scrollable container with a draggable bottom resize handle, allowing
  developers to smoothly expose more vertical space without blowing up
  transcript scroll height.

### 7.4 Chunked Grouping & Transcript Density Modes

To prevent transcript pollution when an agent executes extensive discovery or
complex multi-step pipelines:

- **Parallel Tool Grouping**: When an agent emits multiple tool calls in a
  single step (e.g. 5 parallel reads or searches), they render as a
  consolidated, grouped unit with tabbed or collapsed sub-cards rather than
  separate sprawling cards.
- **Transcript Density Toggle**:
  - **Full / Detailed View**: Shows every individual tool run, thinking block,
    and step output expanded.
  - **Summarized Run View**: Collapses an entire intermediate run into a compact
    summary pill (e.g. `⚡ Executed 6 tools (read, script, bash) in 4.1s`)
    followed directly by the agent's final answer. Clicking the pill expands
    full execution details.
- **Run File Stats & Diff Triggers**:
  - Completed run pills display the total count of modified files (e.g.
    `3 files modified`).
  - **Hover**: Displays a popover list of modified file paths with line deltas
    (`src/server.ts +14 -3`).
  - **Click**: Clicking any file in the list immediately opens it in Monaco's
    Diff Editor.

### 7.5 Rich Media & Media Players

- **Images & Animated GIFs**: Render inline with automatic aspect-ratio
  preservation and zoom/light-box support.
- **Audio & Video**: When models or tools output audio/video content, native
  inline media players provide one-click playback, scrubbing, and download
  controls.
- **Structured Error Cards**: Non-fatal warnings and tool errors render as
  clean, distinct cards with actionable retry/inspect actions rather than raw
  stack trace dumps.

### 7.6 Mid-Run Input Controls (Steer vs. Follow-up)

- **Active Run Input Surface**:
  - The prompt input bar remains active and interactive while an agent run is in
    progress.
  - When the user begins typing during an active run, the submission UI adapts
    to present distinct mid-run options (e.g. dual "Steer" / "Follow up"
    buttons, or a split button).
- **Default Enter Behavior**:
  - Pressing `Enter` defaults to **Steer** (injecting instructions immediately
    after the active tool step completes).
  - A user setting allows toggling the primary `Enter` keybinding default
    between Steer and Follow-up.
- **Visual Distinction**:
  - Steer messages appear inline in the streaming transcript immediately at the
    point of injection with a visual indicator (e.g. "Steered").
  - Follow-up messages appear in a docked "Queued" badge above the prompt input
    bar until the active run settles into `idle`.

### 7.7 Transient Retries & Seamless Continuation ([Continue])

- **Retry Status Pill**:
  - When the runtime encounters a transient provider rate limit or server error,
    the transcript renders an unobtrusive status pill indicating the backoff
    countdown and attempt count (e.g.
    `Rate limited. Retrying in 8s (attempt 2/5)...`).
  - The global Stop button remains active during the wait to allow immediate
    cancellation.
- **One-Click [Continue] Action**:
  - When an in-flight run is aborted by the user or halted due to an external
    error, the input surface and transcript expose a primary **`[Continue]`**
    button.
  - Clicking `[Continue]` immediately resumes the agent loop from the current
    transcript tip without requiring the user to retype or copy prompt context.

### 7.8 Time Travel UI & Storage Management

- **Time Travel Rewind Modal**:
  - Triggered from any historical User or Assistant message node.
  - **Summary Mode Selection**: User selects one of three branch carryover
    modes:
    1. _Standard Summary_ (auto-synthesized learnings from abandoned path).
    2. _Custom Summary_ (text input to specify focus areas).
    3. _Clean Slate / No Summary_ (zero carryover).
  - **File State Reversion Checkbox**: Option to
    `[✓] Revert workspace files to this point`. If the underlying Git snapshot
    was pruned, the checkbox is disabled with an informative tooltip
    (`Snapshot pruned from disk`).
- **Storage & Resource Management (Settings)**:
  - Visual breakdown meter of disk space consumed by Fathom: Run Git Snapshots,
    Artifacts Storage, Media Cache (images/audio/video), and SQLite Databases.
  - **Pruning Actions**: One-click actions to prune snapshots (e.g. _"Prune
    snapshots older than 30 days"_ or _"Clear snapshots for inactive
    sessions"_).
  - **Direct Folder Access**: Buttons to open resource directories directly in
    the host OS file manager (Finder on macOS / Explorer on Windows).

---

## 8. Artifact System & Generative UI (Plans, Widgets, Visual Review)

To support structured planning, rich visual explanations, and interactive
prototypes without cluttering the chat feed or polluting repositories, Fathom
treats artifacts as first-class entities.

### 8.1 Global Storage & Zero Repo Pollution

- **External by Default**: Artifacts are persisted in Fathom's global data
  directory (`~/.fathom/artifacts/<session-id>/<name>.<ext>`) rather than within
  the user's workspace.
- **Clean Git Status**: Creating, iterating on, and reviewing plans or
  prototypes introduces zero untracked files or git noise to the repository.
- **On-Demand Workspace Materialization**: When viewing an artifact in the
  viewer (e.g. an approved plan or architectural spec), the developer can click
  **"Materialize into Workspace"** to save a copy directly into a chosen project
  folder (e.g. `docs/plans/`).

### 8.2 Compact Transcript Presentation (`ArtifactCard`)

- **Feed Cleanliness**: Full documents, large SVG diagrams, and interactive
  HTML/JavaScript are strictly forbidden from rendering directly inline within
  the transcript feed.
- **The Artifact Card**: Renders as a lightweight, structured card:
  - Header with icon, artifact title, file type, and byte size.
  - Status badge: `Pending Review` | `Approved` | `Superseded`.
  - Action triggers: **`[Open in Viewer]`** and (for plans)
    **`[Approve & Proceed]`**.

### 8.3 Dedicated Artifact Viewer Surface

- **Dockable Tab / Drawer**: Opens in a dedicated workspace panel adjacent to
  the Monaco code editor.
- **Interactive HTML & Generative UI**: Standalone interactive widgets,
  visualizations, and simulation tools execute in a sandboxed webview surface,
  granting full interactive viewport width without compromising shell security.
- **Markdown Plan Review & Approval Flow**:
  - Displays rendered markdown with syntax-highlighted code blocks.
  - **One-Click Approval**: Clicking **`[Approve & Proceed]`** emits an approval
    event directly back to the agent loop, transitioning the agent from planning
    to execution.
  - **Visual Annotations & Revisions**: Developers can highlight plan sections,
    attach feedback comments, and stage them in the **Annotation Tray** to
    dispatch a single batched revision prompt.

---

## 9. Git Repository Management & Atomic Commit Studio

### 9.1 Branch & Worktree Controls

- **Status Bar & Sidebar Switcher**:
  - Displays the active Git branch and current worktree name.
  - One-click dropdown to switch branches, create new feature branches, or
    switch between active Git worktrees.
  - Native diff indicator (`+X / -Y` across modified files) with one-click
    navigation to Monaco diff view.
- **Worktree Manager**:
  - Inspect, create, and prune linked Git worktrees.
  - Allows launching an agent session inside an isolated worktree directly from
    the UI.

### 9.2 Intelligent Atomic Commits (`/commit` & Commit Studio)

To eliminate monolithic commits and tedious manual staging:

- **Trigger Points**:
  - Slash command: `/commit` in the chat input.
  - UI Button: "Commit" action in the Git sidebar or run completion banner.
- **Intelligent Semantic Clustering**:
  - Fathom analyzes all unstaged and staged changes across the workspace.
  - Employs the model to cluster related modifications into clean, atomic units
    (e.g. separating refactors from features, separating UI fixes from backend
    migrations).
  - Generates conventional commit messages (`type(scope): subject`) and
    descriptive bulleted bodies for each group.
- **Interactive Commit Studio Interface**:
  - Opens a dedicated modal or drawer staging studio before executing any git
    commands:
  - **Visual Sequence**: Renders the proposed commit pipeline as an ordered
    sequence of cards (e.g. `1. refactor(auth)`, `2. feat(auth)`,
    `3. docs(api)`).
  - **File & Hunk Allocation**: Lists the exact files and diff hunks allocated
    to each commit card.
  - **Developer Direct Manipulation**:
    - **Reorder**: Drag and drop commit cards to adjust the commit sequence.
    - **Move Changes**: Drag files or diff hunks between commit cards.
    - **Split / Merge**: One-click split a commit into two, or merge adjacent
      commits together.
    - **Inline Edit**: Edit commit titles and body descriptions directly.
    - **Discard**: Exclude specific files or revert unwanted changes before
      committing.
- **One-Click Execution**:
  - **`[Execute Commits]`**: Sequentially stages the exact file sets/hunks and
    generates each atomic commit cleanly into Git history.
  - Optional **`[Commit & Push]`** trigger to push to remote tracking branch
    upon completion.

---

## 10. CLI Terminal Client (Terminal UI)

For developers who prefer a keyboard-driven, terminal-first workflow (akin to
Pi, Claude Code, or Aider), Fathom provides a first-class CLI client (`fathom`)
backed by the identical headless server over WebSocket.

### 10.1 Presentation & Terminal Adaptation

- **Streaming Transcript**: Incremental markdown rendering with ANSI syntax
  highlighting and clean terminal reflow.
- **Collapsible Thinking**: Streamed reasoning tokens render as a compact, muted
  status indicator with duration (`Thinking... (2.4s)`). Toggled expanded or
  collapsed via keyboard shortcut (`Ctrl+O`).
- **Terminal Unified Diffs**: File mutations (`write`, `edit`) render as colored
  inline terminal diffs with addition (green) and deletion (red) lines.
- **Compact Tool Statuses**: Clean, single-line status summaries (e.g.
  `⚡ read src/server.ts (124 lines)` or `⚡ bash cargo test (exited 0)`).
- **Interactive Commit Studio (TUI)**: Terminal-based interactive selector
  enabling developers to review, reorder, adjust, and approve AI-generated
  atomic commit clusters using keyboard navigation before Git execution.

### 10.2 Disconnect & Resumption Superpower

- **Session Survivability**: Because the agent loop runs server-side (Accept
  Then Drive), closing a terminal window, exiting SSH, or losing terminal focus
  does not terminate running operations.
- **Instant Re-Attach**: Re-running `fathom` reconnects to the active server
  socket and seamlessly resumes the streaming transcript.

### 10.3 Web & Artifact Degradation

- **Markdown Artifacts**: Render directly in the terminal with
  syntax-highlighted code blocks and headers.
- **Interactive HTML & Generative UI**: Standalone interactive widgets and
  canvases display an inline action to launch in the system browser
  (`[o] Open in browser`), ensuring rich visual experiences remain accessible
  from terminal workflows.
