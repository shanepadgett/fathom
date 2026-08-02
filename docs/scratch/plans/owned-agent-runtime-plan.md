# Owned agent runtime plan

## Purpose

Build Fathom's coding-agent runtime directly on Pi's AI and low-level agent packages while owning the product behavior above the execution loop.

Pi's `AgentHarness` is deliberately outside the design. Its tools, compaction, session tree, persistence, resources, and lifecycle policies overlap with areas where Fathom needs different behavior. Adapting those assumptions would create more work than building the application layer around the smaller `Agent` API.

This plan starts with Pi version `0.83.0`, the version inspected in the reference repository. Any committed dependency must be pinned to an exact version.

## Core decision

Use this boundary:

```text
@earendil-works/pi-ai
  provider protocols, model metadata, normalized messages, streaming
                         │
@earendil-works/pi-agent-core Agent
  model/tool loop, lifecycle events, cancellation, steering
                         │
Fathom runtime
  tools, context, compaction, SQLite, sessions, extensions, desktop API
```

`Agent` is an execution kernel. Fathom's database remains the source of truth. The agent's mutable transcript is a temporary projection used while a run is active.

Do not implement Pi's harness interfaces merely to stay structurally similar to Pi. Reuse ends where Pi begins making product-policy decisions.

## What Pi owns

### AI package

Reuse Pi's:

- provider implementations and protocol compatibility
- model metadata
- normalized user, assistant, and tool-result messages
- streaming text, reasoning, and tool-call events
- usage and stop-reason normalization
- request transport options
- payload and response interception
- custom-provider seam

Provider behavior is compatibility work rather than product differentiation. Reimplementing it would require Fathom to track differences across Anthropic, OpenAI, Google, OpenRouter, Bedrock, and other APIs.

Relevant reference files:

- `packages/ai/src/types.ts`
- `packages/ai/src/models.ts`
- `packages/ai/src/auth/types.ts`

### Low-level agent package

Reuse `Agent` for:

- model/tool turn loop
- streaming lifecycle
- tool argument validation
- sequential and parallel tool execution
- before- and after-tool hooks
- steering and follow-up queues
- cancellation and idle settlement
- in-memory state for the active run
- lifecycle events for messages, turns, and tool execution

Relevant reference files:

- `packages/agent/src/agent.ts`
- `packages/agent/src/agent-loop.ts`
- `packages/agent/src/types.ts`

Fathom's tools implement `AgentTool`, but their internals, results, permissions, and presentation remain ours.

## What Fathom owns

The owned runtime is responsible for:

- tool implementations and registry
- workspace identity and trust
- filesystem and command permissions
- durable sessions and branching
- SQLite schema, migrations, and search
- context projection and token budgeting
- compaction and summary artifacts
- interrupted-run recovery
- model selection and credential policy
- project instructions and resource discovery
- application commands
- extension loading, isolation, and permissions
- typed desktop commands, events, and snapshots
- renderer state and UI

The first implementation should be named after its product role, such as `AgentSession` or `WorkspaceRuntime`. Calling it a harness risks copying Pi's existing abstraction before Fathom's semantics are known.

## Runtime shape

A session runtime will coordinate owned services around one low-level `Agent`:

```ts
interface AgentSessionDependencies {
  repository: SessionRepository;
  contextManager: ContextManager;
  compactionStrategy: CompactionStrategy;
  toolRegistry: ToolRegistry;
  permissionService: PermissionService;
  modelService: ModelService;
  eventPublisher: RuntimeEventPublisher;
  extensionHost: ExtensionHost;
}

class AgentSession {
  readonly agent: Agent;

  // Load, prompt, steer, abort, switch model, compact, branch, and close.
}
```

These are conceptual responsibilities, not approved interfaces. Keep concrete code small until the first end-to-end run shows where boundaries are needed.

### Run lifecycle

For each prompt:

1. Load canonical session and branch state from SQLite.
2. Build the active transcript and context projection.
3. Resolve model, system prompt, active tools, credentials, and permissions.
4. Hydrate `agent.state` with the execution projection.
5. Start the run.
6. Persist canonical lifecycle records from agent events.
7. Publish serializable events to the desktop renderer.
8. Commit the resulting branch head and run status.
9. Reconcile or recover if execution stops unexpectedly.

Only the runtime may mutate `agent.state.messages`. Renderer code and extensions must use runtime commands so database and memory cannot drift independently.

## Persistence model

Use SQLite directly rather than adapting Pi's JSONL `SessionStore`.

The canonical model should probably be an append-only event log with relational projections. Streaming, retries, tool calls, approvals, interruption, branching, and extension artifacts all have lifecycle states that a flat message table tends to erase.

Potential concepts include:

```text
sessions
branches
runs
turns
events
messages
content_blocks
tool_executions
artifacts
context_snapshots
summaries
attachments
```

This is not a proposed schema. The persistence spike must first answer:

- Is the canonical structure an event log, message tree, run graph, or hybrid?
- What constitutes a branch head?
- Can one message or artifact appear on several branches without copying it?
- Which partial streaming state survives a crash?
- Are retries new runs, new turns, or attempts attached to one turn?
- How are tool approvals and rejected calls represented?
- Which records may be edited, and which remain immutable?

Required invariants:

- A persisted event has a stable ID and order.
- A completed model or tool event is never silently lost.
- Branch derivation is deterministic.
- Interrupted runs are detectable after restart.
- UI projections can be rebuilt from canonical data.
- Provider secrets never enter session records.

## Context and compaction

Durable history and provider context are separate objects:

```text
canonical SQLite history
          │
          ▼
context projection
  branch selection, summaries, retrieval, pruning, token budget
          │
          ▼
AgentMessage[] sent through Agent to the model
```

Use `Agent.transformContext` as the first integration seam:

```ts
agent.transformContext = async (messages, signal) =>
  contextManager.buildModelContext(messages, signal);
```

The context manager may:

- select records from the active branch
- insert durable summaries
- retrieve project or external context
- compress large tool results
- omit UI-only events
- enforce provider-specific context limits
- retain exact recent turns while summarizing older work

Compaction should create explicit artifacts with provenance rather than destructively rewrite history. Record at least the source range, strategy/version, model, instructions, token usage, and resulting summary.

`prepareNextTurnWithContext` can change context, model, or thinking state between turns in one active run. Use it only when a decision must happen before the next provider request. Durable state changes still go through the runtime and repository.

## Tool system

Pi's baseline tools are not used. Fathom registers its own `AgentTool` implementations.

The owned tool layer should cover:

- schemas and model-facing descriptions
- execution context resolved for the current run
- workspace path restrictions
- approval policy
- progress events
- cancellation
- output limits and artifact storage
- structured result details for desktop rendering
- audit records
- extension-provided tools

Tool execution happens inside low-level `Agent`, so permission checks belong in `beforeToolCall` and in the tool implementation itself. The hook gives a central policy decision; the tool keeps the trust-boundary check close to the operation. A UI approval cannot be the only enforcement mechanism.

Use `afterToolCall` for normalization or policy-driven redaction before results enter model context. Preserve the unredacted audit record only when storage policy allows it.

## Event handling

`Agent.subscribe()` awaits listeners in registration order. Arbitrary plugin listeners must not attach directly because a slow or broken plugin could delay the entire run.

Attach one Fathom listener that:

1. Reduces required runtime state.
2. Persists records that must be durable before execution continues.
3. Publishes a sanitized event to Fathom's event bus.

The owned event bus then defines explicit behavior for:

- blocking versus observational subscribers
- ordering and priority
- timeouts
- cancellation
- errors and quarantine
- transformation merging
- renderer backpressure

Database durability and tool authorization are blocking concerns. Telemetry, most renderer updates, and observational extension events should not block the agent loop.

## Desktop boundary

Keep the backend authoritative and expose serializable commands, events, and snapshots:

```text
desktop renderer
  transcript, editor, panels, approvals
             │
  typed command/event bridge
             │
desktop host
  windows, native integration, engine supervision
             │
   typed command/event protocol
             │
reloadable Deno agent-engine worker
  AgentSession, SQLite, providers, credentials, tools, extensions
```

Initial commands will likely include:

- prompt
- steer
- abort
- select model
- set thinking level
- approve or reject tool call
- compact
- create or navigate branch
- activate or deactivate tools
- open or close workspace

The agent engine will run in a dedicated Deno module worker from the start. This is an application-lifecycle boundary, not a security boundary. Extensions are trusted internal code and execute directly inside the worker alongside the agent runtime.

Commands, events, and snapshots across the worker boundary must remain serializable. This also leaves room to move execution into a subprocess, local service, or remote host later without replacing renderer contracts.

## Extension boundary

Build extensions against Fathom services, not Pi's coding-agent extension API. Pi's API passes terminal components, themes, editors, keybindings, and other TUI objects directly to extensions. That coupling is unsuitable for a desktop renderer.

Split contributions into two groups.

### Backend contributions

- tools
- providers and models
- commands
- context contributors
- compaction strategies
- resource discovery
- tool policy
- session metadata and indexing
- workspace services

### Renderer contributions

- command-palette entries
- menus and keybindings
- transcript block renderers
- tool-call and tool-result views
- panels and status items
- settings schemas

Prefer declarative UI contributions where they are sufficient. Do not expose live application-framework internals as the stable extension ABI. Extensions are internal and trusted, so the design does not need third-party installation, permission, or sandbox machinery.

## Exact extension reload

Repeated reload during extension development must be exact and reliable. Fathom will use agent-engine worker replacement rather than trying to defeat Deno's process-wide ESM cache.

This differs from Pi. Pi uses Jiti with `moduleCache: false`, rescans extension paths, constructs a fresh extension runner, invalidates old extension contexts, and rebuilds its runtime in the same process. Deno can execute TypeScript without Jiti, but a cache-busted entry import does not reliably reload unchanged URLs for transitive imports, and imported module generations cannot be unloaded.

A fresh worker gives each engine generation a new JavaScript isolate and module graph. Extension entry points, their transitive imports, top-level state, timers, and registrations all start again from current files on disk.

### Worker ownership

Use one worker for the complete headless agent engine, not one worker per extension:

```text
desktop host
       │
       ├── create, monitor, and replace engine worker
       ├── preserve window and native UI lifecycle
       └── reject events from stale worker generations

agent-engine worker
       ├── owned AgentSession runtime
       ├── low-level Pi Agent
       ├── SQLite connection and repositories
       ├── model and credential services
       ├── extension discovery and host
       └── backend extensions loaded as ordinary modules
```

Loading each extension directly inside the engine worker keeps the extension API simple. Tools, hooks, providers, context contributors, and compaction strategies remain ordinary functions and objects. They do not need per-extension RPC proxies.

### Reload lifecycle

The reload command performs a controlled engine replacement:

1. Desktop host sends `prepare_reload` to current engine generation.
2. Engine rejects reload while busy, or the caller explicitly chooses to abort and wait for settlement. Silent interruption is not allowed.
3. Engine commits pending canonical state and marks any aborted run accurately.
4. Engine emits extension/session shutdown lifecycle events.
5. Extension scopes dispose registrations, watchers, subprocesses, timers, and other known resources.
6. Engine closes SQLite statements and connections and returns `reload_ready`.
7. Desktop host terminates old worker. A timeout forces termination if disposal hangs.
8. Host increments engine generation and creates a fresh module worker.
9. New worker rescans configured extension directories and resolves current entry points.
10. New worker imports and activates extensions in deterministic order.
11. Engine reopens SQLite and restores selected workspace, session, branch, model, active tools, extension configuration, and other durable state.
12. Engine publishes a complete authoritative snapshot followed by `engine_ready`.
13. Desktop resumes commands only after matching generation is ready.

Reloading and crash recovery use the same reconstruction path. Reload is graceful replacement; crash recovery is ungraceful replacement with interrupted-run reconciliation.

### Generation protocol

Every worker command, event, response, and snapshot carries an engine generation:

```ts
interface EngineEnvelope<T> {
  generation: number;
  requestId?: string;
  payload: T;
}
```

Desktop host accepts messages only from active generation. This prevents late stream deltas, tool progress, shutdown events, or RPC responses from old worker from mutating newly restored UI state.

Requests sent during replacement fail or remain queued in desktop host according to explicit command policy. They must never be delivered to both generations.

### Extension discovery and activation

Each engine generation rescans extension roots rather than reusing prior module objects. Discovery should return diagnostics without partially activating duplicate or incompatible extensions.

Activation order must be deterministic. Each extension receives a scoped context that records its tools, commands, event handlers, resources, and other contributions. Scope disposal remains useful for diagnostics and ordinary shutdown even though worker termination is final cleanup guarantee.

Old extension contexts carry generation identity and become invalid as soon as reload starts. Any asynchronous callback that reaches host after invalidation fails instead of operating against replacement runtime.

### State that survives reload

Only explicit application state survives worker replacement:

- canonical session, branch, run, and message records in SQLite
- workspace and selected session identity
- model and thinking selection
- active tool names
- extension settings and flags intended to persist
- renderer editor state and other UI-owned transient state

Module globals, closures, timers, uncommitted extension memory, live tool executions, and captured runtime contexts do not survive. An extension that needs state across reload must store it through an owned persistence service.

This provides a useful design test: state lost by a clean reload was stored at the wrong lifetime unless it was deliberately ephemeral.

### Renderer reload

Backend worker replacement does not clear modules already loaded by desktop webview. Start with declarative renderer contributions so backend extension updates arrive in fresh engine snapshot without renderer module loading.

If extensions later include arbitrary renderer code, exact reload requires replacing renderer module graph too. Preferred options are:

1. Reload whole webview after serializing editor/window state, or
2. Put each custom extension view in a disposable iframe and recreate it.

Generation-specific renderer bundle URLs avoid entry caching but still leave old code resident in current page, so they are not exact unload semantics.

### Reload acceptance checks

An automated reload test must prove:

- adding extension makes its contributions available without restarting desktop host
- changing extension entry file changes behavior after one reload
- changing transitive dependency changes behavior after one reload
- removing extension removes every contribution after reload
- old event handlers and commands cannot fire after reload
- old timers and module globals disappear with old worker
- active session and branch reopen at same durable head
- model, thinking level, active tools, and persistent extension settings restore
- stale-generation messages are ignored
- failed extension activation produces diagnostics without corrupting existing SQLite state
- hung shutdown is force-terminated and replacement engine still starts
- repeated reload does not accumulate extension module generations in one isolate

## Deno compatibility gate

Pi's package manifests declare Node support, even though much of the relevant code uses Web APIs. Deno compatibility must be proven before this architecture becomes a commitment.

Create a focused spike using exact package version `0.83.0` and Deno `2.9.4`. Verify:

1. `pi-ai` imports without Node-only initialization failures.
2. `Agent` imports without importing the harness or Node execution environment.
3. Anthropic and OpenAI streams work through Deno.
4. Text, reasoning, and fragmented tool calls stream correctly.
5. Custom Fathom tools execute and report progress.
6. Sequential and parallel tool calls preserve expected ordering.
7. Abort works during provider streaming and tool execution.
8. `transformContext`, `beforeToolCall`, `afterToolCall`, and `prepareNextTurnWithContext` behave as required.
9. Agent events can be persisted to SQLite without lifecycle deadlocks.
10. The selected desktop shell can launch and replace the agent-engine module worker.
11. A fresh worker reloads changes in an extension's transitive imports.
12. Worker replacement can reopen SQLite and restore active session deterministically.

Treat built-in OAuth and Bedrock as separate tracks. Desktop OAuth should eventually own browser launch, callback or deep-link handling, refresh, account selection, and OS keychain storage.

## Build sequence

### Phase 1: prove the kernel

- Add exact Pi package pins to a throwaway Deno spike.
- Run one model prompt through low-level `Agent`.
- Register one existing Fathom tool.
- Exercise tool calls, steering, cancellation, and event ordering.
- Test context transformation without `AgentHarness` imports.
- Record every Node compatibility problem.

Exit condition: low-level `Agent` works in Deno and none of its fixed semantics conflict with the intended runtime.

### Phase 2: settle canonical session semantics

- Write concrete examples for a normal run, tool approval, retry, abort, branch, and compaction.
- Decide event-log, graph, and projection rules.
- Design the minimum SQLite schema around those examples.
- Prove restart recovery from an interrupted provider stream and interrupted tool execution.

Exit condition: session and branch state can be rebuilt deterministically from SQLite.

### Phase 3: build the headless runtime

- Add `AgentSession` or its eventual replacement.
- Hydrate agent execution state from the repository.
- Persist agent events through one internal listener.
- Add context projection and owned compaction.
- Add model, credential, tool, permission, and workspace services.
- Run the headless runtime inside a replaceable Deno module worker.
- Expose generation-tagged commands, events, and snapshots without a desktop UI.
- Implement graceful replacement and forced-termination recovery.

Exit condition: an integration test can create, run, close, reopen, branch, compact, and continue a session.

### Phase 4: add the desktop client

- Render streaming content blocks.
- Add prompt, steer, and abort controls.
- Display tool progress and approvals.
- Add model/account selection.
- Add session and branch navigation.
- Surface recovery and persistence failures clearly.

Exit condition: renderer can be restarted without losing or owning canonical agent state.

### Phase 5: exercise internal extensibility

- Turn selected first-party tools and views into registered contributions.
- Define deterministic hook composition and conflict rules.
- Test extension disposal, deterministic activation, exact worker reload, and stale-generation rejection.
- Prove entry, transitive dependency, addition, and removal reload cases.
- Keep API private while product requirements still move it.

Exit condition: first-party features can use extension seams without privileged access to unrelated runtime internals.

### Phase 6: custom renderer extensions, if needed

- Decide whether declarative contributions have reached their ceiling.
- If needed, choose full webview replacement or disposable extension iframes for exact renderer reload.
- Keep renderer protocol generation-aware and separate from backend objects.

Exit condition: custom renderer code can update and unload without restarting desktop host or leaving stale handlers active.

## Escape hatch below `Agent`

Pi also exports `agentLoop()`, `agentLoopContinue()`, `runAgentLoop()`, and `runAgentLoopContinue()`. They allow Fathom to own transcript mutation, run lifecycle, queue behavior, event reduction, and failure representation.

Do not start there. `Agent` supplies small, useful correctness around concurrent-run prevention, cancellation, queue draining, state reduction, tool tracking, and settlement. Move down to `agentLoop` only after a concrete incompatibility appears in one of those semantics.

If that happens, document the failing scenario and reproduce it in a runnable test before replacing `Agent`. The AI package can remain in place even if Fathom eventually owns the full loop.

## Early decisions still needed

1. What is the canonical session structure: event log, message tree, run graph, or hybrid?
2. Which events must be committed before the loop may continue?
3. How should an interrupted tool call recover after restart?
4. Does compaction affect one branch, inherited descendants, or an immutable context snapshot?
5. How are artifacts shared across branches?
6. Which tool calls require approval, and can policy approve them without UI?
7. Does one `AgentSession` exist per session, branch, window, or active run?
8. Can several windows operate on one session concurrently?
9. Which desktop shell will host the Deno runtime and renderer?
10. Are third-party extensions required for the first usable release?

The next design artifact should answer the first question with worked examples. Session semantics drive the SQLite schema, compaction model, recovery behavior, desktop snapshots, and extension events.
