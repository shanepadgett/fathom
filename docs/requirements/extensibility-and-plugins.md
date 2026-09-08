# Extensibility & Plugin Architecture Requirements

## 1. Kernel Architecture (Cordis IoC)

Fathom composes its services and behavior through plugins powered by Cordis. The
host supplies shared infrastructure, including Cordis and `pi-ai`. There is no
hardcoded agent loop baked into the core host.

### Core Invariants

- **Inversion of Control**: Every major subsystem is exposed as a typed service
  key in Cordis (`context`, `model`, `sessions`, `runtime`, `tools`,
  `workspace`).
- **Service Replaceability**: Service implementations—including the entire agent
  loop (`RuntimeService`)—can be swapped through configuration compositions
  without modifying or rebuilding the host executable. Replacements follow the
  shared SDK contracts; this does not require replacing foundational libraries
  such as `pi-ai`.
- **Explicit Lifecycle**: Plugins declare dependencies (`requires`) and
  exclusive capabilities (`provides`). Setup and teardown are managed through
  scoped disposers (`ctx.effect()`), unwinding cleanly in reverse order on
  failure or shutdown.

---

## 2. Run Lifecycle Hooks & Interceptor Pipeline

To allow plugins deep control without fragile monkey-patching, a `Run` executes
across well-defined lifecycle phases with **Bail & Intercept** semantics.

### Lifecycle Pipeline Phases

```text
UserInput
  │
  ├──► [run:admit]     Validate / transform input (slash commands, attachments)
  ├──► [run:start]     Session state transition, emit UI status
  │
  ├──► Loop: Step
  │      ├──► [step:before]   Context assembly, dynamic prompt injection
  │      ├──► [step:model]    Provider request & stream handling
  │      │
  │      ├──► Tool Dispatch (if ToolCalls present)
  │      │      ├──► [tool:before]   Guardrails / Approvals (CAN BAIL)
  │      │      ├──► [tool:execute]  ToolRun invocation
  │      │      └──► [tool:after]    Sanitize / truncate ToolResult
  │      │
  │      └──► [step:after]    Step completion & checkpointing
  │
  └──► [run:finish]    Durable settlement, notifications, cleanup
```

### Active Hook Mutation Contracts ("Hooks that Change Work")

Hooks are active workflow orchestrators rather than passive event listeners.
Plugins can alter runtime execution by returning typed control objects:

1. **Context Mutation (`step:before`)**:
   - Hooks can return `{ messages: ModelMessage[] }` to dynamically rewrite,
     sanitize, or augment the context payload immediately prior to dispatching
     the provider request.
   - _Use cases_: Injecting ephemeral LSP compiler warnings, appending monorepo
     subfolder `AGENTS.md` rules, or redacting sensitive tokens.
2. **Tool Interception & Approvals (`tool:before`)**:
   - Returning a bail object halts or redirects execution without executing the
     tool handler:
     - `{ action: "block", reason: "..." }`: Denies execution and returns an
       error result to the model.
     - `{ action: "prompt_user", explanation: "..." }`: Escalates execution for
       human approval.
     - `{ action: "mock", result: "..." }`: Short-circuits execution with a
       synthetic result.
3. **Summary Augmentation (`compaction:after`)**:
   - Hooks can return `{ summary: string }` or `{ pinnedArtifacts: string[] }`
     to enrich compaction nodes with critical domain knowledge or pin invariants
     against compression loss.
4. **Autonomous Auto-Continue (`step:after`)**:
   - When a model step finishes without tool calls (which normally causes the
     run to transition to `idle`), a hook can return
     `{ action: "continue", prompt: string }`.
   - _Use cases_: Powering the backend LSP self-healing loop—if modified files
     contain compiler or type errors, the hook intercepts the settlement and
     automatically drives the loop for another step with targeted diagnostic
     feedback before yielding to the user.

### Idle Coordination (Discarding Imperative Callback Queues)

Rather than cloning Pi's monolithic `session.runWhenIdle(fn)` pattern—which
attaches arbitrary lambdas to a state container and creates hidden, unmanaged
callback queues with re-entrancy hazards—Fathom leverages Cordis-native
primitives:

1. **Declarative Event (`session:idle`)**:
   - Emitted across the kernel whenever an active run, its tool executions, and
     settlement hooks finish completely.
   - Handlers register cleanly via standard scoped listeners
     (`ctx.on("session:idle", ...)`).
   - Used by the `FollowUp` queue to admit the next instruction, the hot reload
     watcher to display environment toasts, and Git snapshotters to capture
     settled file state.
2. **Async Coordination Helper (`runtime.whenIdle`)**:
   - Exposed on `RuntimeService`: `whenIdle(sessionId): Promise<void>`.
   - Resolves immediately if the session is currently idle; otherwise resolves
     once the in-flight run terminates.
   - Provides clean `await runtime.whenIdle(id)` coordination for slash commands
     and test harnesses without callback queues.

---

## 3. Unified Full-Stack Plugin Model

Plugins are unified full-stack modules that contribute both backend execution
logic and frontend interface elements from a single package.

### Manifest Structure

A plugin module exports:

- **`id`**: Unique namespace identifier.
- **`apiVersion`**: Supported API contract version.
- **`backend` (Optional)**:
  - `requires` / `provides`: Declared Cordis service dependencies and
    provisions.
  - `activate(ctx)`: Service injection, tool registrations, and lifecycle hook
    interceptors.
- **`frontend` (Optional)**:
  - `activate(host)`: View slot mounting, transcript entry renderers, commands,
    and UI component registrations.

---

## 4. Plugin Scoping: Global vs. Project-Local

To support both universal developer tooling and specialized repository
workflows:

1. **Global Plugins** (`~/.fathom/plugins/` or global composition):
   - Loaded into every session and workspace.
   - Ideal for model providers, core editing tools, general utilities, and
     personal themes.
2. **Project-Local Plugins** (`<workspace-root>/.fathom/plugins/`):
   - Discovered and mounted dynamically when that specific repository is opened.
   - Scoped strictly to that project's Cordis context and unmounted on project
     close.
   - Ideal for repository-specific build helpers, internal database viewers, and
     team-specific domain tools.

### Project Trust & Security Boundaries

To prevent arbitrary Remote Code Execution (RCE) when opening untrusted or newly
cloned repositories:

- **First-Launch Trust Gate**:
  - When a workspace is opened, Fathom verifies if its root path is recorded in
    `~/.fathom/trusted_roots.json`.
  - If untrusted, Fathom halts plugin discovery and displays a trust modal:
    `"Do you trust the authors of this repository? Project-local plugins and scripts will be disabled until trusted."`
- **Restricted Mode (Untrusted Workspace)**:
  - Global plugins (`~/.fathom/plugins/`) continue to function normally.
  - Project-local plugins (`<workspace-root>/.fathom/plugins/`) are **strictly
    prohibited from loading or executing**.
  - Custom project prompts and local skills are disabled.
  - Tool approvals default to maximum safety (Tier 3 manual user escalation for
    any mutating command or script).
  - The status bar displays a persistent `Restricted Mode` badge, allowing the
    developer to review repository files and grant trust when ready.
- **Trusted Mode**:
  - Project-local plugins mount into the project's Cordis kernel normally.

---

## 5. UI Component Registry & Extensible UI Kit

Fathom provides a composable UI ecosystem where plugins can both consume and
extend visual elements:

- **Built-in UI Kit**: Standard set of high-performance components (timeline
  message cards, diff blocks, terminals, split panes, buttons, inputs).
- **Component Contributions**:
  - Plugins can publish new reusable UI components to the registry:
    `host.ui.registerComponent("CustomInspector", ComponentClass)`.

---

## 6. Live Plugin Watching & Idle-Gated Reload Toasts

To enable rapid developer iteration when authoring or modifying plugins:

- **Directory Watchers**: The agent server actively monitors
  `~/.fathom/plugins/` and the active repository's `.fathom/plugins/`.
- **Idle-Gated Notification**:
  - If a file is added, edited, or deleted while a `Run` is in progress, the
    event is queued as pending.
  - The moment the session settles into `idle`, the server pushes a reload event
    to the client over WebSocket.
  - If the session is already idle, the notification is delivered immediately.
- **Client Toast**:
  - The UI presents a non-blocking toast:
    `"Plugin '<id>' was updated on disk. [Reload Environment]"`.
  - Triggering reload disposes existing plugin effects and re-activates the
    composition cleanly without tearing down active conversation state.

---

## 7. Self-Modifying Harness & Agent Developer Experience

The agent is equipped to understand, build, and repair its own plugin ecosystem:

- **Published SDK**: A versioned SDK on JSR exposes plugin manifests, service
  contracts, hooks, and separate backend and browser-safe frontend entry points.
  Authors use it for editor autocomplete and type checking in their own
  repositories. The running host supplies service instances through activation;
  importing SDK types does not start another host.
- **Shared Contracts**: First-party and third-party plugins use the same SDK
  contracts. Default service implementations do not belong in the SDK.
- **Embedded Contracts & Schemas**: Standard plugin interfaces, manifest
  templates, and Cordis integration contracts are embedded in the server as
  native developer documentation.
- **Authoring Workflow**: Users can instruct the agent in plain language (e.g.
  _"Create a plugin for our company's staging deploy API with a custom sidebar
  panel"_). The agent authors the full-stack plugin, places it in
  `.fathom/plugins/`, and prompts the user to reload the environment.

---

## 8. Experience Packages & Native `deno.json` Manifests

The Fathom download includes the host, default composition, and all default
plugin code and assets. First launch does not download default plugins from JSR.
Bundled plugins remain disableable and replaceable through compositions; being a
plugin does not require a separate published package. JSR provides the SDK and
optional plugins or experiences that users choose to install.

To distribute complete, cohesive experiences (e.g. data science workflows,
spatial canvas shells, or domain-specific coding harnesses), repositories define
their Fathom configuration directly within `deno.json`.

### Manifest Schema (`deno.json`)

```jsonc
{
  "name": "@org/fathom-experience",
  "version": "1.0.0",
  "imports": {
    "@std/fs": "jsr:@std/fs@^1.0.0",
  },
  "fathom": {
    // Dynamic glob discovery: automatically mounts any file exporting a valid plugin
    "plugins": ["./plugins/**/*.ts"],
    // Built-in plugins or services to disable
    "disables": ["fathom:builtin:default-shell", "fathom:builtin:runtime-agent"],
  },
}
```

### Dynamic Glob Discovery

- Experience loaders use Deno's native `expandGlob` to match declared patterns
  (e.g. `./plugins/**/*.ts`).
- Discovered modules exporting a default plugin manifest (`id`, `backend`,
  `frontend`) are mounted automatically without manual array bookkeeping.

### DAG Service Conflict Detection

Before activating any experience composition, the kernel validates the directed
acyclic graph:

1. **Orphan Dependency Check**: If an experience disables a plugin that provides
   a required service (e.g. `context`), it must supply an alternative provider
   or startup is rejected with a descriptive conflict error.
2. **Provider Collision**: Rejects configurations where multiple active plugins
   claim the same exclusive service without an explicit disable rule.
3. **Incompatible Disables**: Prevents circular or conflicting disable rules
   across co-installed packages.

---

## 9. Zero-Boilerplate Standalone Plugins

For lightweight personal workflows and repository-specific scripts, developers
are never required to scaffold a full Deno project.

### Single-File Drop-In

- Developers can drop an isolated `.ts` file directly into:
  - Global: `~/.fathom/plugins/<plugin-name>.ts`
  - Project-Local: `.fathom/plugins/<plugin-name>.ts`
- **Native TypeScript Execution**: Runs directly via Deno with zero bundling,
  zero transpilation, and no `package.json` or `deno.json`.
- **Direct Context Injection**: The `activate(ctx)` hook delivers all tools,
  services, and Cordis primitives directly into the script.
- **Ambient IDE Autocomplete**: Fathom generates ambient type definitions at
  `~/.fathom/types/sdk.d.ts`, granting full TypeScript IntelliSense in VS Code,
  Cursor, or Neovim without installing external npm packages.

---

## 10. Custom Session Entries & Context Projectors

Plugins can attach durable domain records directly to the session tree without
fabricating artificial chat messages or maintaining detached side-tables.

### Durable Tree Attachment

- **Typed Records**: A plugin appends a custom entry directly onto the active
  transcript branch via `session.appendCustomEntry({ type, data })`.
- **Branch Awareness**: Custom entries automatically branch, rewind, and persist
  alongside native conversation messages in SQLite, preserving historical
  context per branch.

### Context Projectors (`customEntry -> ModelMessage | null`)

- **Separation of Storage and Visibility**: What is stored on the tree is not
  necessarily fed verbatim to the LLM.
- **Projector Functions**: When assembling context for a model step, the harness
  invokes registered projectors:
  - If the projector returns `null`, the entry remains private to UI rendering
    and plugin logic.
  - If the projector returns a `ModelMessage`, the structured output is injected
    into the active context window.
  - Projectors are pure, synchronous functions with strict token length bounds.

### Frontend Entry Rendering

- In the UI, entries are matched and displayed as custom cards via
  `host.registerEntryRenderer()`.

---

## 11. Specialized Domain Plugins: iOS Development (`plugin-ios`)

As part of Fathom's modular evolution—scaffolding the core harness first before
bringing in specialized toolchains one by one—domain plugins provide tailored
stacks for specific engineering ecosystems.

### Scoping & Enablement

- **Disabled by Default**: Never loaded globally into general web or backend
  projects to preserve resources and keep tool definitions clean.
- **Repository Configuration**: Configured and enabled per-project (e.g. via
  `.fathom/config.json` or project settings) or auto-suggested when repository
  root inspection identifies Xcode projects (`.xcodeproj`, `.xcworkspace`,
  `Package.swift`).

### Capability Bundle

1. **Xcode MCP Server**:
   - Integrates an Xcode MCP server accessed via Scripted MCP
     (`import { xcode } from "fathom:mcp"`).
   - Equips the agent with structured actions to query schemes, build targets,
     and execute unit tests without guessing complex command flags.
2. **iOS Development Skill (`SKILL.md`)**:
   - Encapsulates domain guidance on Swift/SwiftUI conventions, project
     structure, and simulator automation.
3. **Integrated Browser Simulator View**:
   - Supports displaying and interacting with the running iOS Simulator inside
     Fathom's Integrated Browser.
   - Enables the exact same visual annotation and batched feedback workflows
     used for web apps to be applied directly to running iOS apps.
   - _Architecture Note_: Precise technical implementation of the simulator
     display bridge is deferred to the plugin's dedicated design and planning
     milestone.
