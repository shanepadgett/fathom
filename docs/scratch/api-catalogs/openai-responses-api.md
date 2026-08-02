# OpenAI Modern API Surface — Agent Harness Catalog

Research date: 2026-08-01  
Primary surface: **Responses API** (`POST /v1/responses`)  
Docs root: https://developers.openai.com/api/docs  
API reference: https://developers.openai.com/api/reference/resources/responses/

Chat Completions remains supported but Responses is the recommended primitive for new agent work. Assistants API is deprecated (sunset 2026-08-26); Conversations + Responses replace it.

---

## 1. Core endpoints (agent-relevant)

| Endpoint | Role |
| --- | --- |
| `POST /v1/responses` | Create a model response (main generation surface) |
| `GET /v1/responses/{id}` | Retrieve / poll a response (esp. background mode) |
| `POST /v1/responses/{id}/cancel` | Cancel background (and some async) responses |
| `POST /v1/responses/compact` | Standalone context compaction |
| WebSocket `/v1/responses` | Persistent connection for tool-heavy multi-turn loops |
| Conversations API | Persistent conversation objects that prepend/append items around Responses |
| Containers API (`/v1/containers`, files) | Hosted shell / code interpreter runtime lifecycle |
| Skills API (`/v1/skills`) | Upload/version skill bundles for shell environments |
| Files / Vector Stores | Inputs for file search and file inputs |
| Batch API | Async batch over `/v1/responses` among other endpoints |
| Images API | Standalone image gen/edit (also available as Responses tool) |

---

## 2. Request shape (Responses create)

### Top-level fields (agent-useful)

| Field | Purpose |
| --- | --- |
| `model` | Model ID (`gpt-5.6`, `gpt-5.5`, codex variants, o-series, etc.) |
| `input` | String **or** array of typed **Items** (messages, tool results, reasoning, compaction, …) |
| `instructions` | System/developer guidance; **not** carried by `previous_response_id` — resend each turn if needed |
| `tools` | Built-in + custom tool definitions |
| `tool_choice` | `auto` / `required` / `none` / force specific tool / allowed-tools subset |
| `parallel_tool_calls` | Allow multiple tools in one turn |
| `max_tool_calls` | Cap total built-in tool calls in one response (not supported with multi-agent) |
| `max_output_tokens` | Cap output + reasoning tokens |
| `text.format` | Structured outputs (`json_schema` / text); replaces Chat Completions `response_format` |
| `text.verbosity` | Output verbosity control (model-dependent) |
| `reasoning` | Effort, mode, summary, context retention (see §4) |
| `store` | Persist response for later retrieve/chain (`true` default; ZDR forces `false`) |
| `previous_response_id` | Server-side chain to prior response context |
| `conversation` | Attach to Conversations API object ID |
| `stream` | SSE streaming of typed events |
| `background` | Async long-running generation; poll or stream with cursor |
| `include` | Extra payload slices (logprobs, search results, encrypted reasoning, CI outputs, …) |
| `context_management` | Server-side compaction config |
| `prompt` | Reusable dashboard prompt template (`id`, `version`, `variables`) |
| `prompt_cache_key` | Routing/stickiness key for prompt cache |
| `prompt_cache_options` | `{ mode: implicit\|explicit, ttl }` — GPT-5.6+ |
| `prompt_cache_retention` | `in_memory` \| `24h` — pre-GPT-5.6 families |
| `truncation` | `auto` \| `disabled` (default disabled → 400 if over context) |
| `metadata` | Up to 16 string KV pairs |
| `safety_identifier` | Hashed end-user id for abuse detection |
| `service_tier` | `auto` \| `default` \| `flex` \| `priority`/`fast` \| `scale` |
| `temperature` / `top_p` / `top_logprobs` | Sampling (model-dependent; reasoning models often restrict) |
| `user` | Legacy; prefer `safety_identifier` + `prompt_cache_key` |
| `moderation` | Opt-in moderation scores on input/output (added mid-2026) |
| `multi_agent` | Beta multi-agent orchestration (`enabled`, `max_concurrent_subagents`) |

### Input / output model: Items (not just messages)

Responses uses a typed **Item** array instead of Chat Completions' glued `messages`.

Common item types:

- `message` (roles: `user` / `assistant` / `system` / `developer`)
- `reasoning` (opaque CoT; may include `encrypted_content`, optional `summary`)
- `function_call` / `function_call_output` (linked by `call_id`)
- `custom_tool_call` / `custom_tool_call_output`
- Built-in tool calls + outputs: `web_search_call`, `file_search_call`, `code_interpreter_call`, `computer_call` / `computer_call_output`, `shell_call` / `shell_call_output`, `apply_patch_call` / `apply_patch_call_output`, `image_generation_call`, `mcp_*`, `tool_search_call` / `tool_search_output`, `program` / `program_output`, …
- `compaction` (encrypted condensed context)
- Multi-agent items: `multi_agent_call`, `multi_agent_call_output`, `agent_message`
- `additional_tools` (tools injected mid-conversation, e.g. after tool search)

Content parts inside messages:

- `input_text` / `output_text`
- `input_image` (`detail`: `low` \| `high` \| `auto` \| `original`)
- `input_file` (file_id / file_url / file_data; expanded document types)
- Optional `prompt_cache_breakpoint` on content blocks
- Assistant message `phase`: `commentary` \| `final_answer` (important for long tool-heavy GPT-5.4/5.5 flows)

SDK helper: `response.output_text` flattens final text when that is all you need.

---

## 3. State management (critical for harnesses)

Three first-class patterns:

1. **Manual item replay** — append prior `output` (+ tool results) into next `input`; full client control/trimming.
2. **`previous_response_id`** — server holds prior chain; send only new items; still billed for prior input tokens in chain; resend `instructions` each turn.
3. **Conversations API** — durable conversation object; items auto-prepended/appended around each Response.

Stateless / ZDR:

- `store: false` (enforced under ZDR).
- Reasoning items include `encrypted_content` by default; replay them to keep multi-turn reasoning quality without server storage.
- Compaction and WebSocket mode both support ZDR-friendly flows.

WebSocket mode extras:

- Persistent connection; continue with incremental `input` + `previous_response_id`.
- Connection-local in-memory cache of **latest** previous response → lower latency (~40% faster claimed on 20+ tool-call rollouts).
- `response.create` with `generate: false` warms tools/instructions without generating.
- Multi-agent: `response.inject` to push function outputs mid-run without waiting for full completion.
- Limits: one in-flight response per socket; 60-minute connection max; no multiplexing.

Background mode:

- `background: true` for long jobs (Codex / deep research style).
- Poll `GET /responses/{id}` through `queued` / `in_progress` to terminal.
- Can combine with `stream: true` and resume via `sequence_number` cursor.
- Cancel via cancel endpoint.

---

## 4. Reasoning

| Control | Notes |
| --- | --- |
| `reasoning.effort` | Model-dependent: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max` |
| `reasoning.mode` | GPT-5.6+: `standard` (default) or `pro` (more compute; bills aggregated work at standard rates) |
| `reasoning.summary` | `auto` / `concise` / `detailed` (model-dependent); natural-language summary of CoT, not raw tokens |
| `reasoning.context` | GPT-5.6+: `all_turns` (default for 5.6) vs `current_turn`; controls whether earlier-turn reasoning is rendered into next sample |
| Encrypted reasoning | Default on stateless/ZDR; replay items for continued intelligence + better caching |
| Interleaved thinking | Model can emit visible tokens and think between tool calls |
| `phase` on assistant messages | `commentary` vs `final_answer` — preserve when replaying history manually |

Preserve all reasoning + function_call + function_call_output items since last user message when chaining manually.

---

## 5. Tools

### 5.1 Custom function calling

- Shape: internally tagged `{ type: "function", name, description, parameters, strict?, … }` (not Chat Completions' nested `function` wrapper).
- `strict`: Responses defaults toward strict (omit → try normalize; fallback `strict: false`). Explicit `strict: false` for best-effort.
- Output item: `function_call` with `call_id`, `name`, `arguments` (JSON string).
- Return: `function_call_output` with matching `call_id`; `output` can be string **or** multimodal array (text/image/file) — image/file tool outputs supported.
- `output_schema`: describe structured JSON returned in string outputs (esp. for programmatic tool calling).
- `allowed_callers`: `direct` and/or `programmatic`.
- `defer_loading`: hide until tool search loads it.
- `tool_choice`: auto / required / none / force function / allowed subset.
- `parallel_tool_calls: false` → at most one tool call.
- Streaming: `response.function_call_arguments.delta` / `.done`.

### 5.2 Custom tools (free-form / grammar)

- Free-form string I/O instead of JSON schema args.
- Optional CFG via `grammar` (`lark` or `regex`).

### 5.3 Built-in / hosted tools

| Tool type | What it does | Hosted vs local |
| --- | --- | --- |
| `web_search` / `web_search_2025_08_26` | Internet search; filters (`allowed_domains`), `search_context_size` low/med/high, `user_location`, optional `return_token_budget` for long GPT-5+ research | Hosted |
| `file_search` | RAG over vector stores; multi-store; attribute filters (incl. arrays); ranking options | Hosted |
| `code_interpreter` | Python in container; container id or auto; memory limits; network policy | Hosted container |
| `image_generation` | GPT image models as a tool; streaming partial images; multi-turn edits | Hosted |
| `computer` (GA) / `computer_use_preview` (legacy) | Screenshot → batched UI actions (`actions[]`); client executes and returns screenshot | **Client harness** (model returns actions) |
| `shell` | Terminal commands; environments: `container_auto`, `container_reference`, `local` | Hosted **or** local |
| `local_shell` | Legacy local shell type | Local |
| `apply_patch` | Structured file create/update/delete via V4A diffs; client applies | **Client harness** |
| `mcp` | Remote MCP servers (`server_url` / `connector_id` / `tunnel_id`); approvals; list tools | Hosted remote + optional Secure MCP Tunnel |
| `tool_search` | Defer large tool surfaces; load subset at runtime (gpt-5.4+) | Hosted or client execution |
| `programmatic_tool_calling` | Model writes JS that orchestrates eligible tools in isolated V8 | Hosted runtime; client still runs client-owned tools |
| Namespace tools | Group functions under shared namespace for search/organization | — |
| Skills (with shell) | Versioned `SKILL.md` bundles mounted into shell env | Hosted upload, inline zip, or local path |

### 5.4 Shell (detail)

- Responses-only (not Chat Completions).
- Hosted: Debian-based container, cwd `/mnt/data`, languages preinstalled (Python 3.11, Node 22, Java 17, …).
- Memory limits: `1g` / `4g` / `16g` / `64g`.
- Network off by default; org allowlist + request `network_policy.allowlist`; `domain_secrets` for injected auth headers without exposing secrets to the model.
- Reuse via Containers API + `container_reference`.
- Items: `shell_call` (commands, timeout_ms, max_output_length) ↔ `shell_call_output` (stdout/stderr/outcome exit|timeout).
- Local mode: your runtime executes and returns outputs.
- Skills mount on container create or environment `skills` array.

### 5.5 Apply patch (detail)

- Enable: `tools: [{ type: "apply_patch" }]`.
- Model emits `apply_patch_call` with operation: `create_file` | `update_file` | `delete_file` (+ path, V4A `diff`).
- Client applies; returns `apply_patch_call_output` with `status` completed/failed + optional log string.
- Pairs well with shell for discovery + edit loops.
- `allowed_callers` supports programmatic invocation.

### 5.6 Computer use (detail)

- GA tool type `computer` on gpt-5.4+ (migrate off `computer_use_preview`).
- Loop: model returns `computer_call` with `actions[]` → client runs in order → send `computer_call_output` screenshot (`detail: "original"` preferred).
- Actions include click, type, scroll, keypress, drag, wait, screenshot, etc.
- Alternative harnesses: custom tools over Playwright/Selenium/MCP, or code-execution with browser libs.

### 5.7 Tool search

- gpt-5.4+ only.
- Mark tools/`defer_loading: true`, namespaces, or deferred MCP; model loads subset via `tool_search_call` → `tool_search_output` / `additional_tools`.
- Reduces schema tokens, preserves cache, improves latency on large tool catalogs.
- Execution: server-hosted or client (`execution: "client"`).

### 5.8 Programmatic tool calling

- Add `{ type: "programmatic_tool_calling" }`; mark tools with `allowed_callers` including `programmatic`.
- Model emits `program` (JS + fingerprint); runtime calls tools; client-owned tools pause for your `function_call_output` with `caller` preserved.
- Ends with `program_output` + eventual assistant `message`.
- ZDR-friendly (no persistent code container required beyond the run).
- Eligible: function/custom, mcp, apply_patch, shell, code_interpreter. Tool search is top-level only (not inside programs).

### 5.9 MCP / connectors

- Remote MCP in `tools` with server URL or OpenAI-maintained connector IDs (Google, Dropbox, …).
- Enterprise Secure MCP Tunnel for private/on-prem servers.
- Approval request/response items for sensitive MCP tools.
- Streaming events for MCP list/call lifecycle.

---

## 6. Compaction (long-running agents)

Two modes:

1. **Server-side** — `context_management: [{ type: "compaction", compact_threshold: N }]`. When rendered tokens cross threshold mid-generation, server emits encrypted `compaction` item and prunes context. ZDR-ok with `store=false`.
2. **Standalone** — `POST /v1/responses/compact` with full window → returns canonical compacted window (must pass through as-is; do not prune). Fully stateless/ZDR-friendly.

With manual chaining after server-side compaction, you may drop items **before** the latest compaction item. With `previous_response_id`, do not prune.

Multi-agent: standalone compact endpoint unsupported; server-side compaction auto-enabled per agent context when multi-agent is on.

---

## 7. Prompt caching

Automatic for eligible models (gpt-4o+), prefix-based.

Controls:

| Control | Role |
| --- | --- |
| Stable prefix ordering | Static instructions/tools first; dynamic content last |
| `prompt_cache_key` | Improves routing stickiness; **required for reliable matching on GPT-5.6+** |
| `prompt_cache_options.mode` | `implicit` (default, breakpoint on latest message) vs `explicit` (only your breakpoints; avoids cache-write charges on changing suffix) |
| `prompt_cache_options.ttl` | GPT-5.6+: minimum lifetime; currently only `30m` |
| `prompt_cache_breakpoint` | On content blocks; marks exact end of reusable prefix (up to 4 new writes/request) |
| `prompt_cache_retention` | Pre-5.6: `in_memory` vs `24h` extended; gpt-5.5 family is `24h`-only; defaults depend on ZDR |
| Usage metrics | `usage` includes cached token counts |

Notes:

- ~15 RPM per prefix+key before load-balancing dilutes hits.
- GPT-5.5 extended caching only (no in-memory).
- Cache write pricing on GPT-5.6+ can be 1.25× uncached input — explicit breakpoints matter.
- `truncation` + retention_ratio style strategies affect cache stability (naive auto-truncation shifts prefixes).

---

## 8. Streaming

- HTTP SSE: `stream: true`; typed events (not Chat Completions delta chunks).
- Lifecycle: `response.created`, `response.in_progress`, `response.completed`, `response.failed`, `response.incomplete`, `response.queued`, …
- Text: `response.output_text.delta` / `.done`
- Items: `response.output_item.added` / `.done`
- Tools: function arg deltas, web search phases, file search phases, code interpreter code/logs, image gen partials, MCP events, shell, computer, tool search, reasoning summary deltas, etc.
- WebSocket: same event model; client sends `response.create` / `response.inject`.

---

## 9. Multimodal I/O

- **Vision input**: images via URL, base64 data URL, or file_id; detail levels including `original` (no resize on GPT-5.6 family — token heavy).
- **File input**: many doc/presentation/spreadsheet/code/text types via `input_file`.
- **Image generation tool**: multi-turn refine; partial image streaming; sizes including arbitrary WIDTHxHEIGHT on gpt-image-2 family (constraints apply).
- **Tool outputs**: functions can return images/files, not only strings.
- Audio: Responses audio noted as “coming soon” in migration table; Audio API still separate for speech/transcription.

---

## 10. Structured outputs

- `text.format` with `type: "json_schema"`, `name`, `strict`, `schema`.
- Strict schema constraints (no extra props; required fields; supported JSON Schema subset).
- Streaming structured output supported via dedicated events/guides.

---

## 11. Multi-agent (beta, GPT-5.6 family)

- Header/beta: `responses_multi_agent=v1`.
- `multi_agent.enabled: true`; root agent `/root` spawns tree of subagents sharing model + tools.
- `max_concurrent_subagents` default 3 (no fixed depth/total cap).
- Hosted collab actions (do not execute client-side): `spawn_agent`, `send_message`, `followup_task`, `wait_agent`, `interrupt_agent`, `list_agents`.
- WebSocket recommended; `response.inject` for async tool results.
- Auto server-side compaction per agent; no `reasoning.summary`; no `max_tool_calls`; no standalone compact endpoint.

---

## 12. Models (agent-relevant families, as of research)

Naming moves fast; verify current model pages. Families seen in docs/changelog:

- **GPT-5.6** (+ terra/luna cost tiers, sol/pro mode): programmatic tool calling, explicit prompt cache controls, persisted reasoning context, multi-agent beta, original image detail.
- **GPT-5.5 / 5.5 Pro**: 1M context, tool search, computer, hosted shell, apply_patch, skills, MCP, web search, compaction; extended cache only.
- **GPT-5.4 / mini / nano**: tool search, computer GA, 1M context, native compaction.
- **Codex-oriented**: `gpt-5.x-codex`, `gpt-5.1-codex-max`, etc. — long-horizon agentic coding.
- **o-series** still referenced for reasoning + tools in Responses.
- **computer-use-preview** model deprecated path in favor of general models + `computer` tool.

Feature matrix is model-dependent (e.g. tool_search ≥ 5.4; multi-agent on 5.6; reasoning effort enums vary).

---

## 13. Related platform pieces (keep on radar)

| Piece | Harness relevance |
| --- | --- |
| **Agents SDK** (Python/TS) | Higher-level loop: sessions, handoffs, guardrails, approvals, tracing; still sits on Responses |
| **Open Responses** | Open-source multi-provider spec inspired by Responses API shape |
| **Batch** | Offline `/v1/responses` jobs |
| **Flex / Priority / Fast tiers** | Cost/latency tradeoffs via `service_tier` |
| **Reusable prompts** | Dashboard templates referenced by `prompt.id` |
| **Moderation object** | Inline input/output moderation scores |
| **Containers + Files** | Artifact download under `/mnt/data`; CI/shell shared storage model |
| **Vector stores** | file_search backend |
| **Secure MCP Tunnel** | Private MCP for enterprise |

---

## 14. Deliberately de-emphasized for coding-agent harness

- Assistants / Threads / Runs (legacy; sunset path)
- Realtime voice / low-level Audio WebRTC (unless agent is voice-first)
- Fine-tuning / RFT admin surfaces
- Standalone embeddings, classic Completions
- Dashboard-only UX without API exposure
- Chat Completions parity details except where migration affects agent design

Chat Completions still matters if you must support it, but new agent features (hosted tools, shell, apply_patch, compaction, WS mode, multi-agent, etc.) concentrate on Responses.

---

## 15. Harness checklist (what an agent runtime must handle)

1. Build `input` items + `instructions` + `tools` for each turn.
2. Choose state strategy: manual items / `previous_response_id` / conversation / WS.
3. Stream or poll; branch on typed events and output item `type`s.
4. Execute client-side tools (functions, local shell, apply_patch, computer actions); return paired `*_output` items with correct `call_id` / `caller`.
5. Replay reasoning (+ encrypted) and phase-tagged assistant messages when managing context yourself.
6. Compact before context blowups (server-side threshold or `/responses/compact`).
7. Tune prompt cache (stable prefix, key, explicit breakpoints on 5.6+).
8. Optionally enable hosted tools (web, MCP, CI, image) vs pure local tools.
9. For long jobs: background mode and/or WebSocket; handle reconnect + 60m WS limit.
10. Respect model-specific reasoning effort/mode and tool availability.

---

## 16. Primary sources

- Migrate to Responses: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Responses reference: https://developers.openai.com/api/reference/resources/responses/
- Tools overview: https://developers.openai.com/api/docs/guides/tools
- Function calling: https://developers.openai.com/api/docs/guides/function-calling
- Reasoning: https://developers.openai.com/api/docs/guides/reasoning
- Compaction: https://developers.openai.com/api/docs/guides/compaction
- Prompt caching: https://developers.openai.com/api/docs/guides/prompt-caching
- WebSocket mode: https://developers.openai.com/api/docs/guides/websocket-mode
- Background mode: https://developers.openai.com/api/docs/guides/background
- Shell: https://developers.openai.com/api/docs/guides/tools-shell
- Apply patch: https://developers.openai.com/api/docs/guides/tools-apply-patch
- Computer use: https://developers.openai.com/api/docs/guides/tools-computer-use
- Programmatic tool calling: https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling
- Multi-agent: https://developers.openai.com/api/docs/guides/responses-multi-agent
- Streaming: https://developers.openai.com/api/docs/guides/streaming-responses
- Changelog: https://developers.openai.com/api/docs/changelog
