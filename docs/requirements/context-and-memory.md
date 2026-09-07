# Context & Memory Requirements

## 1. The Clean Context Philosophy

The primary objective of context engineering in Fathom is maintaining the
cleanest possible model context window. While prompt caching is valued,
deliberate, one-time cache invalidations (compaction and pruning) are preferred
over dragging noisy, obsolete discovery logs through long execution runs.

---

## 2. The Discover -> Record -> Clean -> Execute Lifecycle

When solving complex engineering tasks, the agent follows a disciplined 4-stage
operational pattern:

### 1. Discover

- Exploration of codebases, documentation, or system environment.
- Involves search commands (`grep`, `find`, exploratory `bash`, reading slices
  of candidate files).
- Produces noisy, transient tool outputs.

### 2. Record (Artifact & Stable Knowledge Generation)

- Before moving to implementation, the agent distills its findings into a
  durable artifact or structured memory note (e.g. key file paths, anchor
  coordinates, technical plan, requirements).
- The recorded knowledge becomes the persistent source of truth.

### 3. Clean (Active Context Pruning)

- The agent calls a dedicated cleanup / pruning action.
- **Pruning Invariants**:
  - Ephemeral `bash` and exploratory `script` command outputs are scrubbed or
    collapsed from the prompt projection.
  - Durable artifacts, file edit histories, and the current session state remain
    intact.
  - The model context is purged of intermediate discovery debris before the
    execution phase begins.

### 4. Execute

- The agent implements changes with a razor-sharp, distraction-free context
  window.

---

## 3. Redundant File Read Prevention (Deduplication)

To prevent models from repeatedly reading unchanged files and bloating the
context window:

- **File State Tracking**: The server tracks the content checksum and mtime of
  every file read into the active session.

---

## 4. Compaction Plugin & Lifecycle Architecture

Compaction is implemented as an independent, replaceable Cordis plugin
(`CompactionService`) rather than hardcoded runtime logic.

### Lifecycle Events

- **`compaction:before`**:
  - Emitted when compaction is triggered.
  - Plugins can register protections to exclude critical data from being
    compressed (e.g. pinning durable artifacts, file anchors, and system
    instructions).
- **`compaction:after`**:
  - Emitted once the compacted snapshot is formed.
  - Notifies listeners to update token accounting, UI markers, and tree node
    metadata.

### Provider-Native vs. Semantic Compaction

- **Provider-Native**: Where available (e.g. OpenAI's dedicated compaction
  APIs), the plugin leverages the provider's native endpoint to maximize
  compression fidelity and cache preservation.
- **Semantic Fallback**: For standard providers, uses structured summarization
  that preserves user goals, completed milestones, durable artifacts, and file
  modifications.

### Structural Compaction Invariants

Compaction is not an ephemeral in-memory string truncation; it is an explicit,
durable operation committed to the SQLite session tree:

1. **Durable Operation Node**: Compaction creates a dedicated summary node on
   the transcript branch, recording the token delta and compacted message IDs.
   Branching and history inspection prior to the compaction boundary remain
   fully accessible.
2. **Atomic Tool Call & Result Pairing**: Compaction cut boundaries **must never
   split a `tool_call` from its corresponding `tool_result`**. Orphaned tool
   calls or dangling results cause strict provider schema validation errors
   (HTTP 400). Any tool invocation boundary must either keep both the call and
   result intact in the active tail, or compact both simultaneously into the
   summary.
3. **Preserved Recent Tail**: A configurable recent tail of raw messages (e.g.
   the active user instruction and last 2–3 execution steps) is strictly
   preserved untouched so the model retains full immediate reasoning fidelity.

### Reactive Overflow Compaction (`Overflow Compact`)

If an upstream provider returns a context length error (e.g.
`context_length_exceeded` / HTTP 400) or pre-flight calculation flags an
impending overflow:

- **Mid-Flight Recovery**: The agent runtime intercepts the error without
  failing the run.
- **Single-Pass Compact & Retry**: The runtime triggers a compaction pass on
  messages prior to the recent tail, updates the request context, and
  immediately retries the step.
- **Loop Guard**: Overflow compaction is bounded to **one attempt per step**. If
  the request fails to fit after a single compaction pass, the run halts with an
  explicit, actionable error to prevent infinite compression loops.

---

## 5. Provider-Locked Branches & Cross-Provider Forking

To ensure provider continuity data, thinking signatures, cache prefixes, and
native compaction never corrupt across incompatible model APIs:

- **Branch Provider Affinity**: Each conversation branch in the session tree is
  locked to the provider family that initiated it.
- **Cross-Provider Forking**:
  - If a user chooses to switch to a model from a different provider (e.g.
    switching from an OpenAI thread to Claude or Gemini), Fathom prompts the
    user to **Fork the thread**.
  - Creates a new child branch rooted at the switch point with a clean,
    provider-agnostic context handoff.
  - Leaves the parent branch's provider cache and continuity tokens 100% intact.

---

## 6. Stable System Prompt Assembly & Plugin Contributions

To maximize provider prompt cache hit rates, the top-level system prompt is
treated as an immutable prefix once assembled for a session.

### Assembly Layers

1. **Base Invariants**: Core tool rules, safety boundaries, and hashline edit
   protocols.
2. **Plugin Contributions**: Plugins can register stable prompt sections (e.g.
   runtime environment details, tool-specific tips) via
   `ctx.get("context").registerPromptSection()`.
3. **Global User Rules (`~/.fathom/AGENTS.md`)**: User preferences applied
   across all projects.
4. **Project Root Rules (`<workspace-root>/AGENTS.md`)**: Repository
   architecture, coding conventions, and testing commands.

### Replacement & Override

- Custom experience packages (via `deno.json`) can override or completely
  replace the default system prompt template to deliver tailored personas
  without modifying the core harness.

---

## 7. Hierarchical `AGENTS.md` & Cache-Preserving Subfolder Injection

In monorepos and multi-package repositories, nested directories frequently
define specialized rules (e.g. `apps/web/AGENTS.md`, `packages/db/AGENTS.md`).

### Mid-Thread Injection (Zero Cache Invalidation)

- **Problem**: Appending subfolder rules directly into the system prompt would
  bust the provider's prompt cache every time the agent switches directories.
- **Solution**:
  - When the agent reads or edits files within a subdirectory containing an
    `AGENTS.md`:
  - The harness intercepts the operation and injects the nested rules **directly
    into the active conversation thread as a contextual system message** at that
    point in time.
  - The root system prompt prefix remains 100% stable and cached, while the
    agent receives precise, localized instructions.

---

## 8. The Agent Skills Standard (`SKILL.md`)

Fathom implements the complete Agent Skills specification for domain expertise
and specialized workflows.

### Frontmatter Schema & Agent Visibility

```yaml
---
name: deploy-kubernetes
description: Production deployment workflow for Kubernetes clusters.
user_invocable: true          # Can be triggered manually by the user via slash command
agent_invocable: false         # Hidden from agent auto-discovery (only user can trigger)
requires_tools:
  - bash
  - script
metadata:
  author: devops-team
  version: 1.0.0
---
```

### Directory Structure & Bundled Assets

- **`SKILL.md`**: Main instructions, preconditions, and decision trees.
- **`scripts/`**: Executable helper scripts that the agent can execute via
  `script` or `bash`.
- **`references/`**: Extended documentation and reference manuals loaded on
  demand.
- **`examples/`**: Canonical examples and configuration templates.

### Discovery Roots

- **Global**: `~/.fathom/skills/<skill-name>/SKILL.md`
- **Project**: `<workspace-root>/.fathom/skills/<skill-name>/SKILL.md` (and
  `.agents/skills/`)
- **Plugins**: Full-stack plugins can package and export their own skills.

---

## 9. Custom Prompts & Dynamic Workflows (Pre-Execution Directives)

To eliminate wasted model turns on predictable information gathering, custom
prompts (slash commands) support dynamic pre-execution shell blocks.

### Prompt Definition Format (`.fathom/prompts/<name>.md`)

Prompts define reusable workflows with embedded shell commands:

````markdown
---
description: Create a conventional commit from staged changes
---

Review the staged changes and generate a conventional commit message:

```!bash
git status --short
git diff --staged
```

Conventions to follow:

- Imperative present tense.
- Group breaking changes separately.
````

### Dynamic Pre-Execution Invariants

1. **Pre-Processing**: When a prompt or slash command is invoked, the harness
   intercepts any dynamic execution directive (`!command` or `!bash ...`).
2. **Direct User Action (Zero Guardrails)**: Because custom prompts are
   explicitly authored and invoked by the user, directives execute as direct
   user actions and **do not pass through the tool approval pipeline or LLM
   guardrails**. (Untrusted repositories in Restricted Mode block project-local
   prompts entirely).
3. **Execution Bounds & Non-Interactive Execution**:
   - Executes non-interactively with `stdin` detached (`/dev/null`) to prevent
     hanging on interactive shell prompts.
   - Enforces a strict execution timeout (default: **10 seconds**). If timed
     out, terminates the process group and marks the block with a timeout
     notice.
4. **Resilient Failure Interpolation**:
   - If a command exits with a non-zero exit code or fails to run, the harness
     does not crash or abort prompt submission.
   - Instead, it interpolates the execution failure directly into the prompt
     block (e.g. `[Command failed (exit 128): fatal: not a git repository]`),
     allowing the model to understand the context of the failure and adapt.
5. **Zero Wasted Turns**: The model receives the full command output directly in
   Turn 1 without making roundtrip tool calls.
