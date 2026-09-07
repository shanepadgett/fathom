# Vocabulary

Shared nouns for the codebase.

This is a short glossary, not the domain model. Keep entries brief. Link to a
deeper design doc when a term needs more than a few lines.

## What belongs here

Add terms that cross code, docs, events, persistence, or UI copy.

Skip local variables, helper names, and implementation details.

Update this file when a shared term is added, renamed, or narrowed.

## AgentRuntime

The runtime area for agent work.

Includes input admission, runs, steps, tools, provider calls, cancellation, and
resume behavior.

### Session

Long-lived work container.

Holds transcript state, runtime records, settings, accounting, and persisted
history.

### ChildSession

Subagent work container linked to a parent session via `parent_session_id`.

Runs in an isolated transcript while rolling up cost and telemetry to the parent
session.

### UserInput

One submitted user payload.

Can include prompt text, files, images, options, or expanded command content.

### Steer

User instruction injected into an active run.

Ingested immediately after the current step's tool finishes to redirect the
active trajectory without starting a new run.

### FollowUp

User instruction queued during an active run.

Held in memory until the current run settles into `idle`, then automatically
admitted as the next run.

### Continue

Action resuming the agent loop from the current transcript head without new user
input.

Used to recover seamlessly from mid-run aborts or recoverable errors.

### RetryWait

Runtime state managing exponential backoff during transient upstream failures.

Pauses step execution while keeping transcript state and abort controls intact.

### Compaction

Durable operation creating a summary node in the session tree to compress
earlier history while strictly keeping recent tail and atomic tool pairings.

### OverflowCompact

Reactive single-pass compaction triggered mid-run when a step encounters a
provider context length limit.

### whenIdle

Async coordination primitive on RuntimeService awaiting session settlement into
idle.

Replaces imperative callback queues with a standard Promise.

### Run

One admitted user input from start to final answer, abort, or error.

Contains one or more steps.

### WorkspaceSnapshot

Shadow Git tree checkpoint recorded upon user prompt submission via
`git write-tree`.

Content-deduplicated baseline enabling workspace file state restoration during
time travel.

### TimeTravel

Operation rewinding the session tree to a previous User or Assistant message.

Supports branch summarization and optional workspace file restoration.

### Step

One model request and one provider stream.

Runs can loop through multiple steps.

### Message

Durable transcript unit.

Can contain user, assistant, or tool-result content.

### ContentBlock

Typed block inside a message.

Examples: text, thinking, image, tool call, tool result.

### CustomEntry

Durable typed plugin record stored directly on the session tree.

Branch-aware artifact retaining plugin state without polluting standard chat
messages.

### Projector

Pure function transforming a CustomEntry into an optional model message during
context assembly.

### Thinking

Model thinking content produced during a step.

Use `Thinking` in code, docs, persistence, and UI copy.

### ToolCall

Model request for tool work.

### ToolRun

One local execution of one tool call.

### ToolResult

Model-visible result of a tool run.

### ToolCheckpoint

Atomic persistence of an individual ToolResult immediately upon execution.

Prevents duplicate execution of completed side effects during crash
reconciliation.

### OutputSpool

Mechanism streaming tool output exceeding 100 KB directly to scratch disk,
providing bounded head/tail slices to the model context.

### PtySession

Long-lived pseudo-terminal process spawned via `bash(background: true)` and
managed through the `pty` tool.

### ExpertConsultation

Autonomous model escalation invoking `consult_expert` to spawn or continue a
persistent child session with an expert reasoning model for complex dilemmas.

### ToolCatalog

Registry holding active baseline tools and deferred tool definitions.

Supports provider-native deferred loading and harness-level tool search.

### ActiveTools

Session-scoped allowlist restricting which tools can be invoked or discovered
via search_tools.

### ScriptedMCP

Execution pattern where external MCP tools are consumed programmatically via the
`script` tool.

Complements direct catalog tool calls for high-volume data aggregation and
multi-step workflows.

### ModelRequest

Provider-neutral request for a step.

### OneOffRequest

Out-of-band model completion detached from the conversation transcript.

Used by plugins, slash commands, and guardrails with TypeBox schemas and cost
attribution.

### ModelEvent

Provider-neutral event raised from a provider stream.

### ProviderAdapter

Provider-specific translator for requests, streams, errors, usage, and hints.

### ProviderHint

Optional provider continuity data.

Examples: response IDs, cache keys, thinking signatures, provider session IDs.

### MediaCache

Durable local storage for generated images and media artifacts.

Decouples binary assets from SQLite transcript storage and prevents repository
bloat.

### RunMetrics

Telemetry captured for one run.

Includes wall-clock duration, input/output/cache tokens, tokens per second, and
dollar cost.

## Workspace & Security

### ProjectTrust

Security boundary gating the loading and execution of project-local plugins and
configuration until explicitly authorized.

### RestrictedMode

Security state for untrusted workspaces where project plugins are blocked and
tool execution requires manual user escalation.

## UI Projection

UI view built from session truth plus UI-local state.

### TranscriptEntry

Selectable or renderable UI card representing a message, tool run, or custom
entry in the transcript feed.

### EntryRenderer

Plugin-registered presentation component rendering a specific TranscriptEntry
type in the transcript feed.

### CommandPalette

Global keyboard-driven action modal indexing registered plugin commands.

### IntegratedBrowser

Native desktop webview surface embedded alongside the editor for viewing local
dev servers and web/simulator canvases.

### AnnotationTray

Staging surface docked above the prompt input bar accumulating visual
annotations and comments for batched submission.

### ScrollDetachment

State where the transcript viewport uncouples from incoming streaming
auto-scroll.

Triggered when the user scrolls upward; restores when scrolled to bottom or on
jump action.

### RunSummary

Compact visual pill representing a completed run's intermediate tool activity.

Replaces sprawling tool cards in summarized transcript density mode.

### Artifact

Durable document or interactive asset (plan, HTML widget, SVG) stored in global
Fathom storage outside the repository.

### ArtifactCard

Compact transcript entry displaying an artifact's metadata and review status
with action buttons to open or approve.

### ArtifactViewer

Dedicated panel surface rendering markdown plans with review controls and
executing sandboxed generative HTML widgets.

### MaterializeArtifact

User action committing a global Fathom artifact directly into the workspace
repository.

### GitWorktree

Isolated working tree provisioned via `git worktree` allowing parallel agent
execution without modifying active editor files.

### AtomicCommitStudio

Interactive visual interface for inspecting, reordering, and adjusting
AI-generated semantic commit clusters prior to Git execution.

## Avoid

### Timeline

Avoid as a container noun for the chat history.

Use `Transcript`, `TranscriptView`, or `TranscriptEntry`.

### Turn

Avoid in core runtime vocabulary.

Use `Run` for the user-input lifecycle. Use `Step` for one model request plus
stream.

### Item

Avoid as a standalone domain noun.

Use a specific word: `Message`, `ContentBlock`, `TranscriptEntry`, `ToolCall`,
or `ModelEvent`.
