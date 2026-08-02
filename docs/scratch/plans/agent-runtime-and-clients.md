# Agent runtime and clients

Working synthesis from architecture discussion (2026-08-02). Companion to [owned-agent-runtime-plan.md](./owned-agent-runtime-plan.md), which covers the Pi boundary and desktop spike technical plan in more detail.

This note records product shape, layering vocabulary, multiplayer vs desktop roles, auth floor, and extensibility policy.

## Vocabulary

Avoid **surface**. It is vague platform jargon and does not match how we talk about the product.

| Term | Meaning |
|------|---------|
| **Agent runtime** | Shared Fathom engine above Pi: sessions, run lock, tools registry, hooks, compaction, events, context fragments. Headless-capable. |
| **Host** | Process that embeds the runtime, loads modules, applies policy, and bridges UI or network. Desktop worker/main is a host. Web backend that runs the agent is a host. |
| **Workbench** | Desktop UI shell: layout regions, panels, composers, tool renderers, keybindings. A client of the runtime via the host. |
| **Conversation fabric** | Product layer for multiplayer human chat: initiatives, threads, members, ACLs, @mentions, notifications. Not part of the agent loop. |
| **Chat client** | Web (or other) UI on top of the fabric. Renders human threads; does not own agent memory. |
| **Module** | Unit that contributes tools, hooks, state, and/or workbench UI through shared APIs. May be first-party or third-party. |
| **Extension** | Module discovered and loaded at runtime (repo-local, user/machine). Implies enablement UI and load lifecycle. |
| **Pi AI** | `@earendil-works/pi-ai` — providers, streaming, model metadata, **auth**. |
| **Pi Agent** | `@earendil-works/pi-agent-core` low-level `Agent` only — turn/tool loop. Not `AgentHarness`. |

## Goals

1. One **agent runtime** used by the desktop coding app and by the enterprise multiplayer chat product.
2. Own product behavior (sessions, tools, compaction policy, permissions, multiplayer bridging). Do not adopt Pi's `AgentHarness` as the product framework.
3. Use Pi for LLM provider mess and the low-level tool loop so we do not reimplement Anthropic/OpenAI/Gemini clients or basic agent streaming.
4. Desktop is where **extensions** and rich workbench UI matter. Web chat is a **curated, closed** host: modular internally, not a plugin marketplace.
5. Support serious workbench extensibility (panels, custom tool UI, layout presets, embedded editors) up to roughly "Tier 3". Do not support full app-shell replacement (Tier 4).

## Stack

```text
┌─────────────────────────────────────────────────────────────┐
│  Chat client (web)          │  Workbench (desktop UI)         │
│  threads, @mention UX       │  layout, panels, composers      │
├─────────────────────────────┴───────────────────────────────┤
│  Conversation fabric (web product domain)                     │
│  initiatives, threads, ACLs, human messages, mention slices   │
├──────────────────────────────┬────────────────────────────────┤
│  Web agent host              │  Desktop host                  │
│  compose modules in deploy   │  load builtins + extensions    │
│  map thread → session        │  approvals, workspace trust    │
├──────────────────────────────┴────────────────────────────────┤
│  Fathom agent runtime                                         │
│  session, run lock, tools, hooks, compaction, events          │
├───────────────────────────────────────────────────────────────┤
│  Pi Agent (`Agent`) — model/tool loop, steer/follow-up        │
├───────────────────────────────────────────────────────────────┤
│  Pi AI — providers, streamSimple, auth, credentials           │
└───────────────────────────────────────────────────────────────┘
```

Runtime must work **headless**. Every UI is a client of runtime events and commands. That is what keeps web and desktop honest.

## Pi boundary (decisions)

### Use Pi AI as the lowest floor

Auth lives in **pi-ai**, not agent-core and not coding-agent.

- Providers own API-key and OAuth flows.
- `Models` resolves credentials on stream/complete (stored credential, else env/ambient).
- `CredentialStore` is injectable; default is in-memory. Apps persist (file, keychain, etc.).
- coding-agent's `auth.json` is only one store implementation. Fathom can own its own store.

OAuth verified present in Pi `0.83.0` for:

| Provider id | Notes |
|-------------|--------|
| `openai-codex` | ChatGPT Plus/Pro. Plain `openai` is API-key only. |
| `anthropic` | Claude Pro/Max |
| `xai` | SuperGrok / X Premium (device code) |
| `openrouter` | PKCE; mints long-lived key; refresh is no-op |

Also: GitHub Copilot and others. Desktop prototype can start on Codex OAuth via existing Pi credentials; long-term Fathom should own credential storage.

### Use Pi Agent low-level only

- `Agent`, `AgentTool`, lifecycle events, `beforeToolCall` / `afterToolCall`, steering queues.
- Inject `streamFn` from Pi `Models` (no provider catalog inside agent-core).
- **Do not** build on `AgentHarness` (session tree, harness tools, harness compaction lifecycle). Overlap with product policy we want to own. See owned-agent-runtime-plan.

### Optional later

If the low-level loop is not enough, extract or rewrite pieces. Do not take harness "for free."

## Two products, one runtime

### Enterprise web — multiplayer AI chat

Spec-driven / initiative workflow. Slack-like threads inside an initiative. Humans talk to each other; the named agent joins when @mentioned.

**Critical split: two transcripts**

1. **Human conversation** — fabric-owned. Many people, long-lived, full history for humans.
2. **Agent session** — runtime-owned. One durable working memory per thread (or per mapped id), tools, compaction.

@mention bridge:

```text
humans chat in thread
        │
 someone @agent
        │
 fabric builds slice since last agent participation
        │
 host: run lock → runtime.run(sessionForThread, slice)
        │
 stream events → fabric posts agent output into thread
```

- Same agent session for repeated @mentions in a thread → continuous memory + compaction.
- Human thread can stay infinitely long; model sees compacted agent memory + latest slice.
- Humans may keep typing during a run; those messages are not in the current run unless product adds steer/queue policy.
- **One active run per session.** Default for enterprise: queue or reject busy; steer is a later power feature.

Web host is **not** an extension marketplace. Tools and modules are composed in deployment (internal packages). UI stays simple; agent scaffolding (e.g. todos) may run without being shown.

### Desktop — coding agent workbench

Primary developer environment. Starts as single-player linear chat against a workspace. Can grow multiplayer later (shared session, multiple actors, live typing) without changing runtime basics: still one session, one run lock, user messages tagged with actor metadata.

- Local (or remote) `ExecutionEnv` for file/shell tools.
- Rich workbench UI and **extensions** (repo-local and machine-wide).
- Multiplayer desktop is mostly host + workbench + sync; not a second agent core.

### Mapping

```text
fabric threadId  →  agentSessionId   (web; created on first @agent or policy)
desktop session  →  agentSessionId   (1:1 in simple linear UI)
```

Optional later: `invocationId` linking a fabric agent episode to a range of session entries for audit ("what did the agent see?").

## Runtime API shape (intent)

Single entry for hosts:

```text
runtime.run({
  sessionId,
  input:
    | { kind: "user_message", text, images?, actor? }    // desktop
    | { kind: "thread_slice", messages, actor? },          // web @mention
  toolPolicy?,
  systemFragments?,
  clientRunId?,   // idempotency for flaky reconnects
})
→ AsyncIterable<RuntimeEvent>
```

Runtime owns:

- session identity and durable transcript (Fathom DB is source of truth; Agent messages are a run projection — see owned plan)
- run lock per session
- tool registry and execution
- hooks (before/after tool, transform context, before run, …)
- compaction policy
- event stream
- context fragments composition

Runtime does not own:

- initiative/thread/ACL/@parse
- live typing / presence
- workbench layout or DOM
- org SSO (receives `actor` from host)

## Extensibility

### Three places, different jobs

| Layer | Extends | Examples |
|-------|---------|----------|
| **Runtime** | What the agent can do | tools, hooks, session-scoped state modules, context fragments, runtime events |
| **Workbench** | How desktop looks/drives | tool renderers, panels, composer, layout presets, editor embeds, keybindings |
| **Host** | Discovery and glue | manifest load, enablement, reload, permissions, wire backend ↔ runtime and UI ↔ workbench |

Extensions are often **one package, multiple contributions**:

```text
module "todos"
  runtime:  todo tools + store + todos_updated events
  workbench: side panel + optional tool cards
  web host:  runtime only (no panel)
```

UI must not be the source of truth for agent state. Panels subscribe to runtime state/events.

### Desktop spike (current prototype)

Path: `spikes/desktop-agent`.

Already demonstrates the split:

- Manifest under `.fathom/extensions/<id>/` with `backend` + `renderer`.
- Backend `activate`: `registerTool`, `registerCommand`.
- Renderer `activate`: `registerToolRenderer`, `replaceComposer`.
- Host: load/enable/reload generation; refuse reload while busy.
- Pi `Agent` + hardcoded `beforeToolCall` for write approval (not yet a general hook registry).

This is the right instinct. Next step is formal runtime module API + workbench slot list, with host loader kept outside the runtime package.

### Web vs desktop policy

| | Web chat product | Desktop coding app |
|--|------------------|--------------------|
| Runtime modules | Yes, composed in deploy | Yes |
| Runtime extension discovery | No | Yes (repo + user/machine) |
| Workbench UI extensions | No (curated chat UI) | Yes |
| Same todo runtime module | Yes, often hidden in UI | Yes, panel optional |

"Extension" means third-party or per-repo **runtime discovery**. Internal web packages can still be modules imported in code.

### Workbench power level (ceiling)

Tiers discussed; **cap at Tier 3**. No Tier 4 full shell replacement as a supported promise.

| Tier | What | Support? |
|------|------|----------|
| 0 | Theme tokens | Yes |
| 1 | Slots: tool renderers, composer replace, panels, commands | Yes (spike starts here) |
| 2 | Layout presets, chrome visibility, required **outlets** (transcript, composer, approval) | Yes |
| 3 | Editor/webview providers (embed browser, Monaco, maybe VS Code-shaped embed) | Yes, carefully |
| 4 | Replace entire app root | No as public model |

Wild but in-bounds examples:

- Center composer, hide until hotkey → layout preset + composer replace + keybindings.
- Full-bleed chat → chrome visibility / immersive preset.
- Embed editor or docs browser → editor/panel provider + host rectangle; agent tools still own files.

Workbench needs a small layout vocabulary: regions, outlets, contributions, commands/keybindings, presets. Crazy UIs remain clients of the same runtime protocol.

### Dogfood modules; do not mod the kernel

**Do:** implement first-party features through the same contribution APIs external extensions use (tools, panels, renderers, commands). Keeps APIs honest. Lets optional built-ins be disabled.

**Do not:** ship the runtime, loader, workbench host, auth spine, or baseline transcript/composer protocol as disableable "extensions."

```text
platform/     # always on: runtime, host bridge, workbench outlets, loader, auth
builtins/     # same APIs; signed; product features toggleable; core tool packs via profiles
extensions/   # user + repo; toggleable
```

Prefer **profiles** (default, read-only/review, immersive) over a flat sea of toggles for baseline tools.

Enablement UI should list optional product modules and user extensions — not "turn off sessions."

## Desktop extension locations (intent)

1. App built-ins (shipped)
2. User/machine — e.g. `~/.fathom/extensions`
3. Repo — `.fathom/extensions`
4. Enterprise policy may allowlist or block 2–3

Strict duplicate names for tools and panels.

## Build order (agreed direction)

1. Runtime skeleton on Pi AI + Pi `Agent`: sessions, loop wiring, events, compaction, tools.
2. Desktop single-player workbench against that runtime (evolve the spike).
3. Fabric bridge: thread → session, `thread_slice` input, run lock, idempotency.
4. Web product uses bridge; curated module compose; simple chat client.
5. Desktop multiplayer only after identity/ACL/sync story exists.
6. Richer workbench layout/editor providers as desktop matures.

## Intentional non-goals (for now)

- Pi `AgentHarness` migration
- Tier 4 replace-the-entire-UI marketplace
- Extension marketplace on the enterprise web chat product
- Treating human fabric history as the model context without an agent session
- Multiple concurrent runs on one agent session without an explicit product policy

## Reference paths

| Item | Path |
|------|------|
| Desktop spike | `spikes/desktop-agent` |
| Spike extensions loader | `spikes/desktop-agent/engine/extensions.ts` |
| Sample extension | `spikes/desktop-agent/fixture-workspace/.fathom/extensions/workspace-kit` |
| Owned runtime / Pi plan | `docs/scratch/owned-agent-runtime-plan.md` |
| Pi reference (local) | tau-agent references: `packages/ai`, `packages/agent` |

## Open questions

- Exact session entry schema and `RuntimeEvent` list (next concrete design step).
- @mention slice rules (what counts as "since last agent," system notes, files).
- Tool/env matrix: full desktop workspace vs restricted web tools.
- How much of spike reload/generation model survives into the real host.
- Fathom-owned `CredentialStore` format vs reading Pi `auth.json` during prototype only.
- Whether todos ship as first-party runtime module with optional workbench panel (likely yes).
