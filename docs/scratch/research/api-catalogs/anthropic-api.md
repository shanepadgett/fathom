# Anthropic Claude API Surface — Agent Harness Catalog

Research date: 2026-08-01  
Primary surface: **Messages API** (`POST /v1/messages`)  
Docs root: https://platform.claude.com/docs  
API reference: https://platform.claude.com/docs/en/api/messages/create  
Base URL: `https://api.anthropic.com`  
Version header: `anthropic-version: 2023-06-01`  
Auth: `x-api-key`  
Betas: `anthropic-beta: <name>` (comma-separated for multiple)

Messages API is the direct model surface for custom agent loops. **Claude Managed Agents** is a separate hosted harness (sessions, sandboxes, event streams) — cataloged briefly at the end; primary focus here is Messages + related APIs a coding-agent harness would call itself.

Also available via Amazon Bedrock, Google Vertex AI, Microsoft Foundry, Claude Platform on AWS — feature parity varies (e.g. web search not on Bedrock).

---

## 1. Core endpoints (agent-relevant)

| Endpoint | Role |
| --- | --- |
| `POST /v1/messages` | Main generation surface (stateless multi-turn) |
| `POST /v1/messages/count_tokens` | Pre-flight input token estimate (tools/images/docs supported) |
| `POST /v1/messages/batches` (+ get/list/cancel/results) | Async bulk Messages at ~50% cost |
| Files API (`/v1/files`, beta) | Upload/list/retrieve/delete/download files by `file_id` |
| Skills API (`/v1/skills`, beta) | Upload/manage custom Agent Skills |
| Models list/retrieve | Model discovery |
| Managed Agents APIs | Hosted agent/session/environment/memory-store surface (separate product) |

Streaming is the same create endpoint with `stream: true` (SSE). No WebSocket mode on Messages.

---

## 2. Request shape (Messages create)

### Top-level fields (agent-useful)

| Field | Purpose |
| --- | --- |
| `model` | Model ID (`claude-opus-5`, `claude-sonnet-5`, `claude-fable-5`, `claude-mythos-5`, `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5`, …) |
| `messages` | Alternating conversation turns (see content blocks). Max 100,000 messages/request. Roles: `user`, `assistant`; on newer models also mid-convo `system` |
| `max_tokens` | **Required.** Hard cap on generated tokens (thinking counts toward it in manual mode). `0` = cache pre-warm only (no generation) |
| `system` | Top-level system prompt: string or text-block array (with per-block `cache_control`) |
| `tools` | Client tools, Anthropic-schema client tools, server tools, MCP toolsets |
| `tool_choice` | `auto` / `any` / `tool` (force name) / `none`; `disable_parallel_tool_use` on auto/any/tool |
| `thinking` | Reasoning config: `enabled`+`budget_tokens`, `adaptive`, or `disabled` (+ optional `display`) |
| `output_config` | `{ effort, format }` — effort levels + JSON structured outputs |
| `stream` | SSE streaming |
| `temperature` | 0–1 (default 1); not fully deterministic at 0 |
| `stop_sequences` | Custom stop strings → `stop_reason: stop_sequence` |
| `metadata.user_id` | Opaque end-user id (abuse detection) |
| `service_tier` | `auto` \| `standard_only` (priority capacity when available) |
| `cache_control` | Top-level automatic cache breakpoint on last cacheable block |
| `container` | Code-execution container id and/or skills list for reuse |
| `mcp_servers` | Remote MCP server defs (with MCP connector beta) |
| `context_management` | Compaction + context-editing strategies (`edits` array) |
| `inference_geo` | Geographic region for inference |
| `top_p` / `top_k` | Sampling (model-dependent; often restricted with thinking) |

### Prefill

Last message may be `assistant` to continue from partial text. **Not supported on Claude 4.6+ and Mythos Preview** (400). Prefer structured outputs / system instructions on those models.

### Mid-conversation system messages

On Claude Fable 5, Mythos 5, Opus 4.8, Opus 5: append `{"role":"system", ...}` (or `mid_conv_system` content blocks) after a user turn without invalidating earlier cache prefix. Not on Sonnet 5 — use top-level `system` only.

---

## 3. Content blocks (I/O model)

Messages are role + content. Content is a string (shorthand for one text block) or an array of typed blocks.

### Input / echoed blocks

| Type | Role |
| --- | --- |
| `text` | Plain text; optional `citations`, `cache_control` |
| `image` | Vision: `source` = base64 / url / file (`file_id`). jpeg/png/gif/webp |
| `document` | PDF/plain text/content blocks/url PDF; optional citations, title, context; `file` source via Files API |
| `search_result` | Client-supplied search hits with citations config |
| `tool_use` | Prior model tool call to echo back (`id`, `name`, `input`, optional `caller`) |
| `tool_result` | Client tool output (`tool_use_id`, `content`, `is_error`); content may nest text/image/document/search_result/`tool_reference` |
| `server_tool_use` | Echo of Anthropic-run tool call |
| `web_search_tool_result` / `web_fetch_tool_result` / `code_execution_tool_result` / `bash_code_execution_tool_result` / `text_editor_code_execution_tool_result` / `tool_search_tool_result` | Echo server tool results (must pass back unmodified, including `encrypted_content` where present) |
| `thinking` / `redacted_thinking` | Must echo complete + unmodified when continuing a tool loop |
| `container_upload` | Attach Files API `file_id` into code-execution container input dir |
| `compaction` | Server compaction summary block — pass back; API drops content before it |
| `mid_conv_system` | Mid-conversation system instruction block |
| `tool_reference` | Deferred tool name loaded via tool search (in tool_result content) |

### Output blocks (assistant)

- `text` (may include citation locations for web/search/docs)
- `thinking` / `redacted_thinking` (signature required for multi-turn continuity)
- `tool_use` (client tools)
- `server_tool_use` + matching `*_tool_result` pairs for server tools
- `compaction` (when compaction fires)

### Response envelope

```
id, type: "message", role: "assistant",
model, content[], stop_reason, stop_sequence?,
usage: {
  input_tokens, output_tokens,
  cache_creation_input_tokens?, cache_read_input_tokens?,
  cache_creation?: { ephemeral_5m_input_tokens, ephemeral_1h_input_tokens },
  server_tool_use?: { web_search_requests, ... }
},
container?: { id, expires_at },
context_management?: { applied_edits: [...] }
```

---

## 4. Stop reasons (harness must handle)

| `stop_reason` | Meaning | Harness action |
| --- | --- | --- |
| `end_turn` | Natural completion | Done / show user |
| `max_tokens` | Hit `max_tokens` | Raise limit or continue generation |
| `stop_sequence` | Hit custom stop | Inspect `stop_sequence` |
| `tool_use` | Client tool(s) requested (or mixed client+server — server deferred) | Run tools → `tool_result` user message; keep same `tools` |
| `pause_turn` | Server-tool loop hit iteration limit (default ~10 sync; higher in batch) | Resend assistant content unchanged to continue |
| `compaction` | Compaction paused (`pause_after_compaction: true`) | Optionally inject content, continue |
| `refusal` | Model declined | Read `stop_details`; fallback model |
| `model_context_window_exceeded` | Output hit context window (4.5+ default; older via beta) | Treat as truncated |

---

## 5. Thinking / extended reasoning

### Modes

| Mode | Config | Notes |
| --- | --- | --- |
| **Adaptive** (preferred on 4.6+) | `thinking: { type: "adaptive", display? }` | Model decides whether/how much to think; auto-interleaves between tool calls. Depth steered by `output_config.effort` |
| **Manual extended** | `thinking: { type: "enabled", budget_tokens: N, display? }` | Fixed budget ≥1024, must be `< max_tokens` (except interleaved). Deprecated on 4.6; **rejected on 4.7+** |
| **Disabled** | `thinking: { type: "disabled" }` | Some models/effort combos forbid (e.g. Opus 5 at `xhigh`/`max`) |
| **Default** | Omit `thinking` | On Claude 5 / Mythos Preview, thinking on by default |

### Display

- `summarized` (default): thinking text returned
- `omitted`: content redacted; signature still returned for multi-turn continuity

### Blocks & continuity

- Response may include `thinking` and/or `redacted_thinking` blocks with cryptographic `signature`
- **Must pass thinking blocks back unmodified** with the assistant turn when sending tool results
- Filtering/rebuilding thinking → 400
- **Interleaved thinking**: adaptive = automatic. Manual needs beta `interleaved-thinking-2025-05-14` on older models (Opus 4.5 / Sonnet 4.5 and earlier Claude 4). Opus 4.6 manual mode does **not** interleave — use adaptive
- **Preservation by model**: Opus 4.5+ and Sonnet 4.6+ keep prior thinking in context (billed as input). Older Opus/Sonnet and Haiku strip prior thinking when non-tool-result user content arrives
- Changing thinking config / budget / effort between turns **invalidates prompt cache** (config is rendered into the prompt)

### Tool choice + thinking

- Manual extended thinking: only `tool_choice` `auto` or `none` (forced tool use errors)
- Adaptive: forced tool use supported

---

## 6. Effort (`output_config.effort`)

Controls thoroughness vs token spend across **all** output (text, tool calls, thinking). No beta header.

Levels: `low` | `medium` | `high` (default / same as omit) | `xhigh` | `max`

| Level | Typical harness use |
| --- | --- |
| `low` | Fast/cheap subagents, simple classification |
| `medium` | Balanced agent loops (often recommended default on Sonnet 4.6) |
| `high` | Default quality for hard coding/agents |
| `xhigh` | Long-horizon coding agents (30m+), heavy tool exploration — Opus 4.7/4.8/5, Sonnet 5, Fable/Mythos 5 |
| `max` | Unconstrained deepest reasoning; costly; not always better |

- Lower effort → fewer/more consolidated tool calls, less preamble
- Hold effort constant within a cached conversation (changing effort busts cache)
- Pair `xhigh`/`max` with large `max_tokens` (e.g. start ~64k)

Also under `output_config`: **`format`** for structured JSON (see §12).

---

## 7. Tool use

### Execution split

| Kind | Who runs | Examples |
| --- | --- | --- |
| **User-defined client tools** | Your harness | Any JSON-schema function |
| **Anthropic-schema client tools** | Your harness; schema trained by Anthropic | `bash`, `text_editor` / `str_replace_based_edit_tool`, `computer`, `memory` |
| **Server tools** | Anthropic infra | `web_search`, `web_fetch`, `code_execution`, `tool_search_*`, advisor, MCP connector tools |

### Client tool loop

1. Request includes `tools[]`
2. Response `stop_reason: tool_use` + one or more `tool_use` blocks (`id`, `name`, `input`, optional `caller`)
3. Harness executes → user message of only `tool_result` blocks (`tool_use_id`, `content`, optional `is_error`)
4. Echo full prior assistant `content` (including thinking) unchanged
5. Repeat until `end_turn` / other terminal reason

SDK **Tool Runner** helpers can auto-loop client tools.

### Custom tool definition fields

| Field | Purpose |
| --- | --- |
| `name` | `^[a-zA-Z0-9_-]{1,64}$` |
| `description` | Critical for selection quality |
| `input_schema` | JSON Schema object |
| `type` | Optional `"custom"` |
| `strict` | Constrained decoding on name+inputs (structured outputs) |
| `cache_control` | Cache breakpoint on this tool def |
| `defer_loading` | Hide from initial prompt; load via tool search `tool_reference` (preserves cache) |
| `allowed_callers` | `direct` and/or `code_execution_20260120` / `20260521` / `20250825` — enables programmatic tool calling |
| `input_examples` | Example input objects |
| `eager_input_streaming` | Per-tool fine-grained input streaming override |

### `tool_choice`

- `auto` — model decides (default); optional `disable_parallel_tool_use`
- `any` — must call some tool
- `tool` + `name` — force specific tool
- `none` — no tools

Parallel tool use default on; disable via `disable_parallel_tool_use: true`.

### Mixing server + client tools

If Claude emits client tool(s) and server tool(s) in the same parallel group, API returns `tool_use` **without** running the server tool yet. Return client `tool_result`s first; server tool runs on the next request.

---

## 8. Built-in / Anthropic tools (detail)

### Server tools

#### Web search — `web_search_20250305` | `web_search_20260209` | `web_search_20260318`

- Live search + citations in text
- Params: `max_uses`, `allowed_domains` XOR `blocked_domains`, `user_location`, `allowed_callers`, `response_inclusion` (20260318: `full`|`excluded` for nested results consumed by code_execution)
- **Dynamic filtering** (20260209+): runs via code execution; filters results before context; auto-provisions CE; default `allowed_callers: ["code_execution_20260120"]`. Set `["direct"]` for non-PTC models
- Must echo `encrypted_content` on results in multi-turn
- Pricing: ~$10 / 1k searches + tokens
- Not on Bedrock; limited on Vertex

#### Web fetch — `web_fetch_20250910` | `web_fetch_20260209`+

- Fetch URL/PDF full content into context as document
- Domain allow/block, max uses, max content tokens, citations
- Dynamic filtering variants pair with code execution
- No extra charge beyond tokens (per docs)

#### Code execution — `code_execution_20250522` (legacy Python) | `code_execution_20250825` | `code_execution_20260120` | `code_execution_20260521`

- Hosted sandbox: bash + file editor sub-tools (`bash_code_execution`, `text_editor_code_execution`)
- No internet in container; preinstalled libs only
- Limits ~5 GiB RAM/disk, 1 CPU; wall-clock limits; 90s/cell under PTC on 20260521 description
- **Container reuse**: response `container.id` (+ `expires_at`); pass back in `container` param. ~30 day lifetime; checkpoint after ~5 min idle
- 20260120+: REPL state persistence + **programmatic tool calling**
- Free when request also has web_search/web_fetch 20260209+; else usage-based
- File outputs → `file_id` downloadable via Files API
- When mixed with client tools, CE result may defer until client results returned

#### Tool search — `tool_search_tool_regex_20251119` | `tool_search_tool_bm25_20251119`

- Discover tools from a large catalog on demand
- Pair with `defer_loading: true` on tools
- Returns `tool_reference` blocks; expands tool defs into conversation body (not system prefix) → **preserves prompt cache**
- Types: regex or BM25

#### Advisor tool

- Faster executor model consults higher-intelligence advisor mid-generation (server-side)

#### MCP connector (beta `mcp-client-2025-11-20`)

- `mcp_servers[]`: `{ type: "url", url, name, authorization_token? }` — HTTPS remote only (Streamable HTTP or SSE); no local STDIO
- `tools[]` entry type `mcp_toolset`: `{ mcp_server_name, default_config?, configs?, cache_control? }` — allow/deny/configure per tool
- Multiple servers per request; tools-only subset of MCP spec
- SDK helpers for client-side MCP (stdio, prompts, resources) convert to Claude types
- Works in Message Batches
- Not ZDR eligible

### Anthropic-schema client tools (you execute)

#### Bash — `bash_20250124`, name `bash`

- Persistent shell session semantics in your environment

#### Text editor

| Type | Name |
| --- | --- |
| `text_editor_20250124` | `str_replace_editor` |
| `text_editor_20250429` | `str_replace_based_edit_tool` |
| `text_editor_20250728` | `str_replace_based_edit_tool` (+ optional `max_characters`) |

- view / create / str_replace style file edits for coding agents

#### Computer use (beta headers)

| Beta / type | Models |
| --- | --- |
| `computer-use-2025-11-24` / `computer_20251124` | Opus/Sonnet 5, Opus 4.8/4.7/4.6, Sonnet 4.6, Opus 4.5 |
| `computer-use-2025-01-24` / `computer_20250124` | Sonnet/Haiku 4.5, older Claude 4 |

- Params: `display_width_px`, `display_height_px`, `display_number?`, `enable_zoom?` (20251124)
- Actions: screenshot, click, type, key, mouse_move; enhanced: scroll, drag, right/middle/double/triple click, mouse down/up, hold_key, wait; 20251124: **zoom** region
- Your harness runs the desktop/VM; classic agent loop with screenshots as image blocks
- Combine with thinking/effort (docs suggest medium on Sonnet/Opus 4.6 UI tasks)

#### Memory — `memory_20250818`, name `memory` (GA, no beta)

- Client-side file memory under `/memories` prefix
- Commands: `view`, `create`, `str_replace`, `insert`, `delete`, `rename`
- API injects system instruction: always view memory before work; assume interruption
- You implement storage (filesystem/DB); SDKs ship helpers + `BetaLocalFilesystemMemoryTool` + tool runner
- Path traversal protection mandatory
- Pairs with context editing + compaction for long agents
- Separate from Managed Agents **memory stores** (server-mounted dirs)

---

## 9. Programmatic tool calling (PTC)

- Claude writes code in the code-execution sandbox that calls tools as functions
- Tool results return to the **running script**, not necessarily into model context → filters/loops without bloating tokens
- Enable by setting tool `allowed_callers` to include `code_execution_20260120` (or later); omit `direct` to prefer code-only invocation
- Response `tool_use.caller` identifies `direct` vs code_execution caller
- Needs `code_execution_20260120+` (Haiku 4.5 accepts type but PTC/REPL persistence unavailable there)

---

## 10. Skills (beta)

Headers: `skills-2025-10-02` + `code-execution-2025-08-25` (+ `files-api-2025-04-14` for file I/O)

- Skills = folders with `SKILL.md` (+ resources); progressive disclosure (description in context, full file on demand)
- Specified on Messages via `container.skills[]`: `{ type: "anthropic"|"custom", skill_id, version? }`
- Up to **8 skills** per request
- Anthropic-managed IDs: `pptx`, `xlsx`, `docx`, `pdf` (version date or `latest`)
- Custom: upload via Skills API → `skill_01...` ids
- Requires code_execution tool; may return `pause_turn`; reuse `container.id`
- Generated files → Files API download

---

## 11. Prompt caching

Two modes:

1. **Automatic**: top-level `cache_control: { type: "ephemeral", ttl?: "5m"|"1h" }` — breakpoint on last cacheable block, advances as conversation grows
2. **Explicit**: `cache_control` on individual blocks (tools, system text blocks, message content, tool results, images, documents, MCP toolsets, etc.)

### Prefix order (hierarchy)

`tools` → `system` → `messages` (each level builds on previous)

### TTL

- Default **5 minutes**, refreshed on use (no extra cost)
- **1 hour** via `ttl: "1h"` (extra cost); better for batches

### Pre-warming

- `max_tokens: 0` writes cache without generating (no output billed). Incompatible with manual extended thinking (`budget_tokens` must be < max_tokens)

### What invalidates

- Changing tools/system/thinking config/effort/budget
- On older models: non-tool-result user content strips thinking and breaks following cache
- `defer_loading: true` tools excluded from cache key until loaded via tool search

### Usage fields

`cache_creation_input_tokens`, `cache_read_input_tokens`, detailed 5m/1h creation splits

Thinking blocks: cannot mark directly; cached when part of prior assistant turns with other content; count as input when read from cache.

---

## 12. Structured outputs

GA on Claude 4.5+ (and Mythos Preview); no beta required (old `output_format` + beta still transitionally work).

### JSON outputs

```json
"output_config": {
  "format": {
    "type": "json_schema",
    "schema": { ... }
  }
}
```

- Constrained decoding → valid JSON in text content block
- SDK parse helpers (Pydantic/Zod/etc.)

### Strict tool use

- `strict: true` on tool defs → guaranteed schema-valid tool names/inputs
- Can combine with JSON outputs in one request

JSON Schema support is a subset; SDKs transform unsupported constraints into descriptions + validate locally.

---

## 13. Context management

`context_management.edits[]` can combine strategies.

### Compaction (beta `compact-2026-01-12`)

Edit type: `compact_20260112`

| Param | Default | Notes |
| --- | --- | --- |
| `trigger` | `{ type: "input_tokens", value: 150000 }` | Min value 50_000 |
| `pause_after_compaction` | `false` | If true → `stop_reason: compaction` after summary only |
| `instructions` | null | **Replaces** default summarizer prompt entirely |

Flow:

1. Input hits trigger → API summarizes → emits `compaction` content block → continues (unless paused)
2. Client appends full assistant content including compaction block
3. Next request: API ignores all blocks **before** last compaction block

Streaming: compaction arrives as single delta (not token-streamed).  
Supported on Claude 4.6+ family, Sonnet/Opus 5, Fable/Mythos 5, Mythos Preview.  
ZDR eligible.

### Context editing (beta `context-management-2025-06-27`)

Server-side clearing **before** the prompt hits the model. Client keeps full history locally.

#### Clear tool uses — `clear_tool_uses_20250919`

| Param | Default | Purpose |
| --- | --- | --- |
| `trigger` | 100k input tokens (or tool_uses count) | When to activate |
| `keep` | 3 recent tool uses | Preserve newest pairs |
| `clear_at_least` | none | Min tokens cleared (cache economics) |
| `exclude_tools` | none | Never clear these tool names |
| `clear_tool_inputs` | `false` | Also clear tool_use inputs, not just results |

Cleared results become placeholders. Invalidates cache at clear point — design `clear_at_least` accordingly.

#### Clear thinking — `clear_thinking_20251015`

- Drops old thinking blocks when configured thresholds hit
- Keeping thinking preserves cache; clearing invalidates at that point

Response includes `context_management.applied_edits` with counts/tokens cleared (also on stream `message_delta`).

### Choosing compaction vs editing vs memory

| Mechanism | Role |
| --- | --- |
| Tool/thinking clearing | Surgical prune of bulky stale tool payloads / old CoT |
| Compaction | Summarize whole earlier transcript near window limit |
| Memory tool | Persist facts across sessions/compactions on client storage |

Long coding agents often use all three.

---

## 14. Streaming (SSE)

`stream: true` on Messages create.

### Event types (typical)

- `message_start` → partial message + early usage
- `content_block_start` / `content_block_delta` / `content_block_stop`
- Deltas: `text_delta`, `input_json_delta` (tool inputs), thinking deltas, etc.
- `message_delta` → `stop_reason`, final usage, context_management
- `message_stop`
- `ping`
- Error events

### Fine-grained tool streaming

- Stream tool input JSON incrementally without buffering full valid JSON
- Beta and/or per-tool `eager_input_streaming: true`
- Useful for large patches/commands in coding agents

---

## 15. Files API (beta `files-api-2025-04-14`)

| Op | Notes |
| --- | --- |
| Upload | → `file_id`; max **500 MB**/file; **500 GB**/org |
| List / retrieve / delete | Standard management |
| Download | Only files **created by** skills or code_execution (`downloadable: true`); uploads not downloadable |

Reference in messages:

- `image` / `document` source `{ type: "file", file_id }`
- `container_upload` for code-execution datasets

---

## 16. Message Batches API

- `POST /v1/messages/batches` with many `{ custom_id, params }` Messages requests
- ~**50% cost**, higher throughput; most finish &lt; 1 hour
- Supports vision, tools (including server tools + MCP), thinking, multi-turn, most betas
- **Not** supported: `stream`, fast mode/`speed`, threads/`store`/`previous_thread_event_id`, some routing hints, `max_tokens: 0`, research preview
- Prefer **1h prompt cache** TTL for shared prefixes
- Server-tool agentic loop runs more iterations before `pause_turn` than sync
- Poll status; fetch results JSONL

---

## 17. Token counting

`POST /v1/messages/count_tokens`

- Same shape as create (messages, system, tools, images, documents, thinking…)
- Returns `{ input_tokens }` estimate
- Does not apply real cache writes; system-added tokens may appear in counts but aren't billed the same way
- Tokenizer changed ~Opus 4.7 / Fable 5 / Mythos 5 (~30% more tokens for same text) — always count with target `model`

---

## 18. Vision & documents

- Images: base64, URL, or Files API; jpeg/png/gif/webp
- PDFs: base64, URL, or file; optional citations
- Plain text documents; content-block documents
- `search_result` blocks for RAG-style cited context
- Place instruction text **before** screenshots for computer-use accuracy

No first-party image **generation** tool on Claude Messages (analysis only). Skills can produce office/PDF files via code execution.

---

## 19. Containers (code execution runtime)

Not a full standalone Containers CRUD API like OpenAI's in the same way — lifecycle is tied to Messages:

- Created implicitly when code_execution/skills run
- Returned as `container: { id, expires_at }` on response
- Reuse: pass `container: { id }` or string id + optional `skills[]`
- Skills attached via `container.skills`
- Expiry ~30 days; idle checkpoint ~5 minutes

---

## 20. Auth, versioning, betas, capacity

| Concern | Detail |
| --- | --- |
| Auth | `x-api-key: $ANTHROPIC_API_KEY` |
| Version | `anthropic-version: 2023-06-01` (current long-lived) |
| Betas | `anthropic-beta: a,b,c` |
| User profiles | Optional `anthropic-user-profile-id` + beta |
| Service tiers | `service_tier`: auto (allow priority) vs standard_only |
| ZDR | Feature-specific; compaction/memory tool/many core paths eligible; MCP connector & Files API often not — check retention docs |

### Notable beta headers (agent-relevant)

| Header | Feature |
| --- | --- |
| `compact-2026-01-12` | Server compaction |
| `context-management-2025-06-27` | Tool/thinking clearing |
| `mcp-client-2025-11-20` | MCP connector (replaces `mcp-client-2025-04-04`) |
| `files-api-2025-04-14` | Files API |
| `skills-2025-10-02` | Skills |
| `code-execution-2025-08-25` | (and related) code execution / skills |
| `computer-use-2025-11-24` / `computer-use-2025-01-24` | Computer use |
| `interleaved-thinking-2025-05-14` | Manual interleaved thinking (older models) |
| `managed-agents-2026-04-01` | Managed Agents APIs |
| `agent-memory-2026-07-22` | Managed Agents memory stores |
| `model-context-window-exceeded-2025-08-26` | Opt older models into soft context overflow stop |

---

## 21. Claude Managed Agents (adjacent product)

Pre-built hosted harness — **not** a drop-in replacement for Messages, but agent-relevant:

- Agents, environments, sessions, event streaming, interrupt/redirect
- Built-in agent toolset in sandbox
- MCP servers declared on agent; credentials via vaults at session start
- Memory stores mounted under `/mnt/memory/...` (up to 8/session; 2000 memories/store; 100 kB/memory)
- Beta `managed-agents-2026-04-01`
- Better for long-running async tasks on Anthropic infra; custom coding harnesses usually stay on Messages

---

## 22. Models snapshot (agent orientation)

IDs and windows move quickly; verify against models overview. Approximate current flagship picture from docs:

| Tier | Example IDs | Notes |
| --- | --- | --- |
| Flagship agent/coding | `claude-opus-5`, `claude-opus-4-8`, `claude-opus-4-7` | Long agents, PTC, skills, computer use |
| Balanced | `claude-sonnet-5`, `claude-sonnet-4-6` | Default workhorse |
| Fast | `claude-haiku-4-5` | Subagents, high volume; some PTC limits |
| Special | `claude-fable-5`, `claude-mythos-5`, `claude-mythos-preview` | Newest intelligence / domain strengths |

Context: up to **1M tokens** on several Opus/Sonnet 4.6+ / 5-class models; Haiku often 200K. Max output up to 64k–128k depending on model.

---

## 23. Agent-harness feature checklist

| Capability | Anthropic support |
| --- | --- |
| Stateless multi-turn messages | Yes — full history each call |
| Server-side conversation store | No on core Messages (Managed Agents/sessions instead; no Responses-like `previous_response_id`) |
| Streaming SSE | Yes |
| WebSocket agent loop | No |
| Custom tools + parallel + force | Yes |
| Strict schema tools | Yes (`strict: true`) |
| Structured JSON output | Yes (`output_config.format`) |
| Hosted web search / fetch | Yes (server) |
| Hosted code interpreter | Yes (code_execution + containers) |
| Hosted shell | Via code_execution bash sub-tool (hosted) or client `bash` tool |
| Apply-patch / text editor | Client text_editor tools; CE file editor |
| Computer use | Yes (beta, client-executed) |
| MCP | Yes — remote connector + client SDK helpers |
| Tool search / deferred tools | Yes |
| Programmatic tool calling | Yes (via CE) |
| Skills | Yes (beta, CE-backed) |
| Memory | Client memory tool + Managed Agents memory stores |
| Prompt caching | Yes — automatic + explicit; 5m/1h; pre-warm |
| Compaction | Yes — server-side beta |
| Context editing (clear tools/thinking) | Yes — beta |
| Effort / reasoning controls | Yes — adaptive/manual thinking + effort levels |
| Encrypted thinking continuity | Yes — signatures / redacted_thinking |
| Files API | Yes — beta |
| Token counting | Yes |
| Batch | Yes — 50% off |
| Image generation | No first-party |
| Multi-agent primitive | No first-class multi-agent on Messages (compose via tools/subagents yourself; Managed Agents is hosted) |
| Background mode | No Responses-like background; use Batch or Managed Agents sessions / `pause_turn` continuation |
| ZDR considerations | Per-feature matrix |

---

## 24. Practical coding-agent loop (Messages)

```
system + tools (+ cache_control) + optional container/skills/mcp_servers
messages: [..., user]

loop:
  response = POST /v1/messages (stream?)
  append assistant content (verbatim: thinking, tool_use, server blocks, compaction)

  switch stop_reason:
    end_turn → break
    tool_use → run client tools → append user tool_results only
    pause_turn → continue with same tools (server loop)
    compaction → optional inject → continue
    max_tokens / model_context_window_exceeded → handle truncation
    refusal → fallback

  ensure context_management edits still set
  reuse container.id when present
```

---

## 25. Primary doc links

- Messages create: https://platform.claude.com/docs/en/api/messages/create
- Tool use overview: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Tool reference: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-reference
- Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Thinking: https://platform.claude.com/docs/en/build-with-claude/thinking
- Effort: https://platform.claude.com/docs/en/build-with-claude/effort
- Compaction: https://platform.claude.com/docs/en/build-with-claude/compaction
- Context editing: https://platform.claude.com/docs/en/build-with-claude/context-editing
- Structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- MCP connector: https://platform.claude.com/docs/en/agents-and-tools/mcp-connector
- Files: https://platform.claude.com/docs/en/build-with-claude/files
- Skills: https://platform.claude.com/docs/en/build-with-claude/skills-guide
- Memory tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- Computer use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
- Code execution: https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool
- Web search: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- Batches: https://platform.claude.com/docs/en/build-with-claude/batch-processing
- Stop reasons: https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons
- Token counting: https://platform.claude.com/docs/en/build-with-claude/token-counting
- Features overview: https://platform.claude.com/docs/en/build-with-claude/overview
