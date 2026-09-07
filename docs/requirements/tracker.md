# Fathom Requirements & Scope Tracker

This document tracks all features, capabilities, and vocabulary being aligned
during the conversational design process.

## Status Summary

- **Completed**: All Core Requirement Domains Aligned & Documented (Section 1:
  Architecture & Persistence, Section 2: Tools & Execution, Section 3: Model
  Gateway & Routing, Section 4: Context & Customization, Section 5:
  Extensibility & Compositions, Section 6: Frontend & UX).
- **Completed**: All Runtime Concepts Evaluated & Aligned (Section 7: Accept
  Then Drive, WebSockets, Steer/Follow-up, Retry Wait & Continue, Compaction
  Invariants, Time Travel & Snapshots, Custom Entries, Active Hooks, Adaptive
  Concurrency, Output Bounds, Active Tools, Cordis Idle Primitives, Workspace
  Trust).
- **Current Phase**: Technical planning: technologies and versions, architecture
  and repository layout, then an ordered build plan. Track progress in
  `docs/technical/tracker.md`. SDK release and compatibility rules remain open
  and carry into that phase.

---

## 1. Architecture & Persistence

- [x] **Agent Server Topology**: Daemon vs. child process
      (`docs/requirements/architecture-and-persistence.md`).
- [x] **Multi-Client Support**: Desktop app, CLI client (`fathom`), Web browser
      UI; remote mobile deferred
      (`docs/requirements/architecture-and-persistence.md`).
- [x] **Session Persistence**: SQLite schema, periodic checkpointing, crash
      recovery (`docs/requirements/architecture-and-persistence.md`).
- [x] **Session Tree & Branching**: Strict tree history with parent pointers,
      permanent retention, active head pointer
      (`docs/requirements/architecture-and-persistence.md`).
- [x] **Workspace Scoping**: Per-project session management and repository
      isolation (`docs/requirements/architecture-and-persistence.md`).
- [x] **Git Worktree Isolation**: Provisioning child sessions/runs in isolated
      worktrees (`.fathom/worktrees/<task-id>`) for non-destructive parallel
      execution (`docs/requirements/architecture-and-persistence.md`).

## 2. Tools & Execution

- [x] **Core Tool Suite**: `read` (3k window, 3-char hashline), `write`
      (atomic), `edit` (hashline replace/insert/delete), `bash` (sync &
      background PTY), `pty` (background process manager)
      (`docs/requirements/tools-and-execution.md`).
- [x] **`script` Execution**: Multi-runtime discovery, scratch runner, and
      iterative patching (`docs/requirements/tools-and-execution.md`).
- [x] **Deferred Tool Loading & Scripted MCP**: 100% harness-level
      `search_tools` (BM25/FTS5 local catalog), unified `plugin-web`, and
      mandatory `script` code mode for MCP
      (`docs/requirements/tools-and-execution.md`).
- [x] **Tool Sandboxing & Approvals**: 3-stage pipeline (User Hard Deny,
      Deterministic Safe Allow with pipe/compound matching, and Intent-Aware LLM
      Verification Gate auto-approving or escalating with plain-English
      explanation) (`docs/requirements/tools-and-execution.md`).
- [x] **Expert Model Consultation (`consult_expert`)**: Autonomous model
      escalation for complex dilemmas via persistent child sessions with
      multi-turn continuity (`consultation_id`)
      (`docs/requirements/tools-and-execution.md`,
      `docs/requirements/model-gateway-and-routing.md`).

## 3. Model Gateway & Routing

- [x] **Provider Integration**: Standardized on `pi-ai` for all upstream
      providers as a core server dependency; SDK plugins contribute gateways,
      model catalogs, and backend routing policy
      (`docs/requirements/model-gateway-and-routing.md`).
- [x] **Modes & Personas (Plugin Architecture)**: Pluggable `plugin-modes` with
      provider-aware auto-assignment; detailed persona workflow planning
      deferred post-scaffold (`docs/requirements/model-gateway-and-routing.md`).
- [x] **Thinking Budgets**: Native delegation to `pi-ai` clamping and allowed
      level inspection (`docs/requirements/model-gateway-and-routing.md`).
- [x] **Multi-Modal / Image Generation**: Dynamic `generate_image` tool,
      dual-paradigm support (Grok Imagine, Responses, Nano Banana), media cache
      with workspace override
      (`docs/requirements/model-gateway-and-routing.md`).
- [x] **Tiered System Prompt Hierarchy**: Model overrides, provider defaults,
      and universal baseline fallback
      (`docs/requirements/model-gateway-and-routing.md`).
- [x] **One-Off Model Invocations & TypeBox Schema Engine**: Unified
      `ModelService.complete()` for plugins/guardrails with TypeBox native JSON
      Schema validation, forced tools, and cost attribution
      (`docs/requirements/model-gateway-and-routing.md`).
- [x] **Expert Model Escalation & Child Routing**: Provider-locked branch
      protection with isolated child session routing and telemetry rollup
      (`docs/requirements/model-gateway-and-routing.md`).

## 4. Context & Customization

- [x] **Clean Context Lifecycle**: Discover -> Record -> Clean -> Execute
      pattern (`docs/requirements/context-and-memory.md`).
- [x] **Active Context Pruning**: Scrubbing transient bash/script discovery
      noise while retaining durable artifacts
      (`docs/requirements/context-and-memory.md`).
- [x] **Redundant Read Prevention**: File checksum tracking to block re-reading
      unchanged files (`docs/requirements/context-and-memory.md`).
- [x] **Context Compaction & Token Budgeting**: Dedicated compaction plugin with
      lifecycle hooks (`compaction:before`/`after`) and provider-native API
      support (`docs/requirements/context-and-memory.md`).
- [x] **Provider-Locked Branches**: Locking branch affinity to model family and
      forking on provider switch (`docs/requirements/context-and-memory.md`).
- [x] **Skills System**: Complete Agent Skills standard (`SKILL.md`,
      `agent_invocable` visibility, scripts, references)
      (`docs/requirements/context-and-memory.md`).
- [x] **Custom Prompts & Dynamic Workflows**: Pre-execution directives
      (`!command`) interpolating local outputs directly into prompt Turn 1
      (`docs/requirements/context-and-memory.md`).

## 5. Extensibility & Compositions

- [x] **Plugin-Composed Services**: Cordis lifecycle and service injection over
      shared core infrastructure
      (`docs/requirements/extensibility-and-plugins.md`).
- [x] **SDK & Bundled Defaults**: Published SDK contracts for plugin authors;
      default plugins ship with the host without first-launch JSR downloads
      (`docs/requirements/extensibility-and-plugins.md`).
- [ ] **SDK Release & Compatibility Rules**: Define public exports, host/API
      version compatibility, and published experience loading before SDK
      release.
- [x] **Run Lifecycle Hooks & Interceptors**: Interceptor pipeline with bail
      semantics for guardrails
      (`docs/requirements/extensibility-and-plugins.md`).
- [x] **Unified Full-Stack Plugins**: Single manifest exporting backend Cordis
      services & frontend UI contributions
      (`docs/requirements/extensibility-and-plugins.md`).
- [x] **Plugin Scoping**: Global (`~/.fathom/plugins/`) vs. Project-Local
      (`.fathom/plugins/`) (`docs/requirements/extensibility-and-plugins.md`).
- [x] **Configurations / Compositions**: Native `deno.json` manifests, glob
      discovery, and DAG conflict detection
      (`docs/requirements/extensibility-and-plugins.md`).
- [x] **Standalone Single-File Plugins**: Zero-boilerplate `.ts` drop-in plugins
      with ambient IDE types (`docs/requirements/extensibility-and-plugins.md`).
- [x] **Self-Modification & DX**: Built-in harness documentation for agent
      self-improvement (`docs/requirements/extensibility-and-plugins.md`).
- [x] **Hot Watcher / Reload Toasts**: Live file system watching with idle-gated
      UI notifications to reload environment on plugin edits
      (`docs/requirements/extensibility-and-plugins.md`).
- [x] **Specialized Domain Plugins (`plugin-ios`)**: Disabled by default,
      repo-configured; bundles Xcode MCP, iOS Skill, and simulator view support
      (`docs/requirements/extensibility-and-plugins.md`).

## 6. Frontend & User Experience

- [x] **Embedded Code Editor**: Monaco editor, non-separation philosophy,
      synchronized agent navigation, and native diffs
      (`docs/requirements/frontend-and-ux.md`).
- [x] **Integrated Browser & Visual Annotations**: Native desktop webview
      surface, element/area visual annotations, and batched annotation staging
      tray (`docs/requirements/frontend-and-ux.md`).
- [x] **Backend LSP Gateway & Self-Healing**: Real-time squigglies in Monaco +
      automated compiler error feedback to agent
      (`docs/requirements/frontend-and-ux.md`).
- [x] **Pluggable UI Shell**: Custom transcript entry renderers
      (`registerEntryRenderer`), dockable views (`registerView`), surface
      overrides, global command palette (`Cmd+K`), fluid layout containers
      (`docs/requirements/frontend-and-ux.md`).
- [x] **Cost Tracking & Runtime Observability**: Per-run telemetry (wall-clock
      time, tokens, cache hit %, tokens/sec, dollar cost via `pi-ai`), SQLite
      rollups (session/daily), and live inspector gauge
      (`docs/requirements/frontend-and-ux.md`).
- [x] **Streaming Transcript & Density Controls**: Real-time markdown streaming,
      scroll detachment, collapsible thinking blocks, resizable tool cards with
      drag handles, parallel call grouping, run density compaction, run file
      edit telemetry, and rich media players
      (`docs/requirements/frontend-and-ux.md`).
- [x] **Artifact System & Generative UI**: Global storage outside repo, compact
      ArtifactCard in transcript, dedicated ArtifactViewer tab for plans and
      sandboxed HTML, batched annotations, and on-demand workspace
      materialization (`docs/requirements/frontend-and-ux.md`).
- [x] **Git Repository Management & Atomic Commit Studio**: Branch and worktree
      switcher, `/commit` slash command, and interactive visual studio to
      reorder, adjust, and approve AI semantic commit clusters
      (`docs/requirements/frontend-and-ux.md`).
- [x] **CLI Terminal Client**: First-class terminal UI (`fathom`), streaming
      markdown, collapsible thinking, inline diffs, TUI commit studio, and
      seamless reconnect (`docs/requirements/frontend-and-ux.md`).

## 7. Runtime Concepts to Lift (from pi)

Pending individual discussion. Do not treat as agreed until checked.

- [x] **Operation Machine & Accept Then Drive**: Pragmatic SQLite-native
      execution model ("Database as Truth") with atomic intent writes,
      server-driven loop, and on-demand crash reconciliation
      (`docs/requirements/architecture-and-persistence.md`).
- [x] **Lane Snapshot**: Simplified away in favor of direct SQLite
      `GET /messages` queries + live WebSocket frame attach without complex
      replay buffers (`docs/requirements/architecture-and-persistence.md`).
- [x] **Steer vs Follow-up vs Next-run**: Steer redirects active run after
      current tool finishes (default Enter); Follow-up queues in memory until
      idle; Next-run eliminated as a distinct protocol concept (standard idle
      input) (`docs/requirements/architecture-and-persistence.md`,
      `docs/requirements/frontend-and-ux.md`).
- [x] **Retry Wait**: Transient failures back off and resume (max 5 attempts,
      exponential backoff with jitter); global Stop button active; steer cancels
      wait immediately; clean aborts with synthetic ToolResult enable seamless
      `[Continue]` resumption
      (`docs/requirements/architecture-and-persistence.md`,
      `docs/requirements/frontend-and-ux.md`).
- [x] **Overflow Compact**: Mid-flight reactive recovery when encountering
      context length limits; single-pass compaction prior to recent tail with
      immediate retry; bounded loop guard
      (`docs/requirements/context-and-memory.md`).
- [x] **Compaction as an Operation**: Durable summary nodes in SQLite session
      tree; atomic tool call/result pairing invariant (never split); preserved
      recent tail (`docs/requirements/context-and-memory.md`).
- [x] **Branch Summary**: Time travel limited to message boundaries; 3 summary
      modes (standard, custom prompt, clean slate); Git-backed workspace
      snapshots enable optional file reversion; storage management and graceful
      fallback (`docs/requirements/architecture-and-persistence.md`,
      `docs/requirements/frontend-and-ux.md`).
- [x] **Custom Entries**: Typed durable session tree records
      (`session.appendCustomEntry`); projectors
      (`customEntry -> ModelMessage | null`) for selective context projection;
      UI presentation via `registerEntryRenderer`
      (`docs/requirements/extensibility-and-plugins.md`,
      `docs/requirements/frontend-and-ux.md`).
- [x] **Loop Hooks that Change Work**: Active mutation contracts: context
      rewrites (`step:before`), tool bailing/mocking/approvals (`tool:before`),
      summary augmentation (`compaction:after`), and autonomous auto-continue
      (`step:after`) powering LSP self-healing
      (`docs/requirements/extensibility-and-plugins.md`).
- [x] **Tool Checkpoints**: Immediate atomic ToolResult commits prevent
      side-effect re-execution on crash; adaptive execution concurrency
      (parallel reads, sequential mutations)
      (`docs/requirements/tools-and-execution.md`).
- [x] **Output Bounds**: Truncate or spill huge tool output (>100 KB) to scratch
      disk; head/tail slicing for model context with Monaco log viewer
      (`docs/requirements/tools-and-execution.md`).
- [x] **Active Tools**: Dynamic per-session allowlist/denylist integrated with
      modes; hard schema omission and deferred `search_tools` catalog filtering
      (`docs/requirements/tools-and-execution.md`).
- [x] **Idle APIs**: Discarded Pi's imperative callback queues in favor of
      Cordis `session:idle` events and `runtime.whenIdle(sessionId)` Promise
      helper (`docs/requirements/extensibility-and-plugins.md`).
- [x] **Project Trust**: Workspace trust model gating project-local plugin
      execution and configuration; Restricted Mode fallback preventing RCE on
      cloned repos (`docs/requirements/extensibility-and-plugins.md`,
      `docs/requirements/frontend-and-ux.md`).
