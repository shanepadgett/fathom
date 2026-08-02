# xAI API Catalog (Agent-Harness Features)

Research snapshot for coding-agent harness work. Primary sources: [docs.x.ai](https://docs.x.ai). Prefer **Responses API** (`POST /v1/responses`); Chat Completions is legacy.

**Base URL:** `https://api.x.ai/v1`  
**Auth:** `Authorization: Bearer $XAI_API_KEY`  
**SDKs:** OpenAI-compatible REST/SDK (`base_url=https://api.x.ai/v1`), native **xAI Python SDK** (gRPC; full surface including Collections, Batch, Voice, management), Vercel AI SDK `@ai-sdk/xai`.

---

## 1. Primary surfaces

| Surface | Endpoint / transport | Role |
|--------|----------------------|------|
| **Responses API** (preferred) | `POST /v1/responses` | Stateful or stateless chat; agentic server tools; reasoning; structured outputs |
| Responses retrieve / delete | `GET/DELETE /v1/responses/{id}` | Fetch or drop stored response (30-day TTL when `store=true`) |
| **Context compaction** | `POST /v1/responses/compact` | Shrink long conversation into opaque compaction item |
| **WebSocket Responses** | WS `/v1/responses` | Long-lived socket for multi-turn agent loops; always streamed |
| Chat Completions (legacy) | `POST /v1/chat/completions` | Stateless OpenAI-style chat; function calling only (no native agentic tools) |
| Deferred chat completion | `POST` chat + `GET /v1/chat/deferred-completion/{request_id}` | Fire-and-poll once within 24h |
| Batch API | Batch create/list/results (+ JSONL via Files) | Async bulk; tools supported; model support varies |
| Files | `/v1/files` | Upload private files for chat attachment |
| Collections | Collections API (+ console) | Persistent RAG stores; `collections_search` / `file_search` tool |
| Documents search | `/v1/documents/search` | Direct collection semantic search |
| Images | `/v1/images/generations`, `/v1/images/edits` | Grok Imagine image gen/edit |
| Video | `/v1/videos/*` | Grok Imagine video gen/edit/extend |
| Models | model list / pricing docs | Capability + pricing catalog |

OpenAI SDK pattern:

```text
OpenAI(api_key=XAI_API_KEY, base_url="https://api.x.ai/v1")
client.responses.create(...)
```

---

## 2. Responses API (core)

### 2.1 Request shape (high level)

- **`model`** — e.g. `grok-4.5`, `grok-4.3`, `grok-4.20-*-reasoning`, `grok-build-0.1`, `grok-4.20-multi-agent*`
- **`input`** — string or array of messages / typed items (not `messages`)
- **`instructions`** / system messages in `input`
- **`tools`** — function tools + built-in server tools
- **`tool_choice`** — `auto` | `required` | `none` | force specific function
- **`parallel_tool_calls`** — default on; set `false` to serialize client function calls
- **`max_output_tokens`** (Responses) / `max_tokens` (Chat Completions)
- **`stream`** — SSE (HTTP); WebSocket always streams events
- **`store`** — default **`true`**: persist response 30 days for `previous_response_id` chaining; set `false` for ZDR-style local-only
- **`previous_response_id`** — continue stored (or WS in-memory) conversation without resending full history
- **`include`** — extra payload: `reasoning.encrypted_content`, tool outputs, `verbose_streaming` (SDK), citations controls, code execution file outputs, etc.
- **`prompt_cache_key`** — sticky routing for prompt cache (same role as `x-grok-conv-id` header on Chat Completions)
- **`reasoning` / `reasoning_effort`** — effort control (model-dependent)
- **`response_format`** — structured outputs (`json_schema` / `json_object` / `text`)
- **`max_turns`** — cap assistant/server-tool turns inside one agentic request (xAI SDK / agent tools)

### 2.2 Response shape

- **`id`** — response id for retrieve / chain / delete
- **`output`** — typed items, e.g.:
  - `message` (`output_text`, annotations)
  - `reasoning` (+ optional `encrypted_content`)
  - `function_call` (client-side)
  - `web_search_call`, `x_search_call`, `code_interpreter_call`, `file_search_call`, `mcp_call`
- **`usage`** — input/output/total, `cached_tokens`, `reasoning_tokens`, server-side tool counts, sources used, optional cost ticks
- **Citations** — URL list + optional inline `[[N]](url)` + annotation offsets

Chat Completions equivalent fields still matter for legacy path: `choices[].message.content`, `reasoning_content`, `tool_calls`, `finish_reason` (`stop` | `length` | …), `refusal`.

### 2.3 Stateful chaining

1. **Server store (default):** `store=true` → keep `previous_response_id` → send only new `input` items. Stored **30 days**.
2. **Encrypted content (ZDR / no store):** `include: ["reasoning.encrypted_content"]` or SDK `use_encrypted_content=True`; append prior `response.output` (including encrypted reasoning + tool state) into next `input`.
3. **WebSocket mode:** open WS to `/v1/responses`; send `response.create` per turn with `previous_response_id` + only new items. In-memory cache on the connection works even with `store=false` / ZDR. Max connection ~**25 minutes**. Warmup: `generate: false` primes tools/instructions without model run.
4. **Retrieve / delete** stored responses by id.

Follow-up turns need not reuse the same tools/model config; state still hydrates from prior response when chaining.

---

## 3. Streaming

- **SSE** when `stream: true` on HTTP Responses / Chat Completions.
- Responses streaming events align with OpenAI-style names (e.g. `response.output_text.delta`, reasoning summary/text deltas).
- **Agentic streaming recommended:** live server-side tool call visibility, reasoning token progress, long-running tool loops.
- SDK: `include=["verbose_streaming"]` for richer intermediate visibility.
- Reasoning models: raise client timeout (docs often use 3600s).
- **Function-call streaming caveat:** custom function calls arrive **whole in one chunk**, not argument-token-streamed.
- Image **generation** models do not stream tokens the same way as text models.

---

## 4. Tools

Two categories; can mix in one request.

### 4.1 Client-side function calling

- Define `type: "function"` tools with `name`, `description`, JSON Schema `parameters`.
- Root schema must be `object` (or `anyOf`/`oneOf` of objects). Non-object roots → **400**.
- Max **~200 tools** per request (function-calling docs); REST ref also mentions **128** in places — treat as hard product limit to verify against current reference.
- Model returns `function_call` / `tool_calls`; **you** execute and return results.
- **`tool_choice`:** `auto` | `required` | `none` | force named function.
- **`parallel_tool_calls`:** default enabled.
- Tool args always schema-conform; **`strict` is implicitly always true** (no opt-out flag needed).
- With streaming: function call not partial-streamed.
- Works on Responses + Chat Completions; **agentic built-ins are Responses / xAI SDK path**, not legacy Chat Completions agent loop.

### 4.2 Server-side built-in (Agent Tools)

Model orchestrates multi-step tool use on xAI infrastructure until final answer (or client tool pause).

| Capability | Responses / REST type | xAI SDK | Notes |
|-----------|----------------------|---------|-------|
| Web search + browse | `web_search` | `web_search()` | Domains allow/deny (max 5), image understand, image search embeds |
| X (Twitter) search | `x_search` | `x_search()` | Handles allow/deny (max 20), date range, image/video understand |
| Code execution | `code_interpreter` | `code_execution()` | Python sandbox; optional outputs/files via `include` |
| Collections / RAG search | `file_search` | `collections_search()` | `vector_store_ids` / `collection_ids`, `max_num_results` |
| Attachment search | (implicit) | via file attachments | Auto-enabled when files attached to message |
| Remote MCP | `mcp` | `mcp(...)` | xAI connects to your MCP server over streamable HTTP/SSE |
| View image (internal) | via search flags | — | `enable_image_understanding` → `view_image` usage |
| Image search (internal) | via web_search flag | — | `enable_image_search` → markdown `![](url)` embeds |

**Web search params:** `allowed_domains` / `excluded_domains` (mutually exclusive, max 5), `enable_image_understanding`, `enable_image_search`. Filters sometimes nested under `filters` in OpenAI-SDK examples.

**X search params:** `allowed_x_handles` / `excluded_x_handles` (max 20), `from_date` / `to_date` (ISO8601), `enable_image_understanding`, `enable_video_understanding` (X-only).

**Code execution:** no extra required config in basic form; opt into outputs:

| Include (xAI SDK) | Include (Responses) |
|-------------------|---------------------|
| `code_execution_call_output` | `code_interpreter_call.outputs` |
| `code_execution_files_output` (files from CE) | → `output_files` on response |

**Collections search:** Responses uses OpenAI-compatible `file_search` + `vector_store_ids`; citations as `collections://{collection_id}/files/{file_id}`.

**Remote MCP tool fields:**

| Field | Required | Notes |
|-------|----------|-------|
| `server_url` | yes | Streaming HTTP or SSE only |
| `server_label` | yes | Prefixes tool names; identity in usage |
| `server_description` | no | Helps model route |
| `allowed_tools` / `allowed_tool_names` | no | Empty = all tools from server |
| `authorization` | no | Bearer token to MCP server |
| `headers` / `extra_headers` | no | Extra HTTP headers |

Multiple MCP servers allowed. MCP call outputs always returned on Responses API; xAI SDK can `include=["mcp_call_output"]`.

### 4.3 Hybrid client + server tools

1. Server tools run automatically on xAI.
2. Client `function_call` **pauses** the agent; you execute and continue via:
   - `previous_response_id` + tool result items, or
   - encrypted content append path.
3. Detect client vs server:
   - SDK: `get_tool_call_type(tool_call)` → `client_side_tool` | `web_search_tool` | `x_search_tool` | `code_execution_tool` | `collections_search_tool` | `mcp_tool`
   - Responses: `output[].type` → `function_call` vs `web_search_call` / `x_search_call` / `code_interpreter_call` / `file_search_call` / `mcp_call`

### 4.4 `max_turns`

- Limits **assistant/server-side tool turns** inside **one** HTTP request, not total client-tool round trips.
- One turn may still run **multiple parallel** server tools.
- After a client tool pause, the next request gets a **fresh** `max_turns` budget.
- Unset → server default cap; agent then answers with what it has.

### 4.5 Tool observability & billing

- **`tool_calls` / stream chunks:** all attempted invocations (incl. failures).
- **`server_side_tool_usage`:** successful billable counts (e.g. `SERVER_SIDE_TOOL_WEB_SEARCH`).
- Failed tool attempts not billed.
- Default: large server tool **outputs omitted**; opt in via `include` (see streaming-and-sync docs).
- Token pattern for agentic: high cumulative `prompt_tokens` across internal steps; strong prompt-cache reuse; `completion_tokens` ≈ final text only; `reasoning_tokens` separate.

Internal web-search function names seen in usage mapping: `web_search`, `web_search_with_snippets`, `browse_page`, `open_page`, `open_page_with_find`, `search_images`, `view_image`.  
X: `x_user_search`, `x_keyword_search`, `x_semantic_search`, `x_thread_fetch`, `view_x_video`.

### 4.6 Citations

- **`citations`:** full URL list of sources encountered (always on for agent search).
- **Inline:** markdown `[[N]](url)` in text + structured annotations (`url_citation`, start/end indices).
  - Responses API: inline **on by default**; disable with `include: ["no_inline_citations"]`.
  - xAI Python SDK: opt in with `include=["inline_citations"]`.
- Collection cites use `collections://…` URIs.

---

## 5. Reasoning

- Reasoning models expose **`reasoning_tokens`** in usage.
- **Encrypted reasoning:** `include: ["reasoning.encrypted_content"]` (or SDK `use_encrypted_content`); required for multi-turn cache/state when not using `previous_response_id` store path.
- **Summarized reasoning:** streamable reasoning summary / text deltas (`response.reasoning_summary_text.delta`, `response.reasoning_text.delta`, SDK `chunk.reasoning_content`).
- **`reasoning.effort` / `reasoning_effort`:**
  - **`grok-4.5`:** `low` | `medium` | `high` (default **high**). Reasoning **cannot be disabled**.
  - REST also documents **`grok-4.3`** effort including `none` | `low` | `medium` | `high` (default low if unset) — model-specific; check current model card.
  - **`grok-4.20-multi-agent`:** effort maps to **agent count** (`low`/`medium` ≈ 4 agents; `high`/`xhigh` ≈ 16), not depth alone.
- Reasoning models reject `presence_penalty`, `frequency_penalty`, `stop`.
- Chat Completions path: limited/no encrypted reasoning content vs Responses (prefer Responses for reasoning agents).

---

## 6. Structured outputs

- **`response_format`:**
  - `type: "json_schema"` + schema (primary)
  - `type: "json_object"`
  - `type: "text"` (default)
- Tool/function parameters always strict-schema.
- Can combine structured final answer with agentic tools and/or client tools.
- xAI SDK: `chat.parse(PydanticModel)` or pass model to `response_format` + `sample()`/`stream()`.
- Streaming structured: partial JSON string builds across chunks.

---

## 7. Multimodal input

### 7.1 Image understanding (vision)

- Content parts: `input_image` + `input_text` (Responses) or Chat Completions image_url parts.
- `image_url`: public URL or `data:image/jpeg;base64,...`
- `detail`: e.g. `high`
- Limits: max **20 MiB**/image; **jpg/jpeg, png**; no hard count limit documented; any text/image order.
- Usage tracks `image_tokens` / `prompt_image_tokens`.

### 7.2 Files attached to chat (attachment_search)

- Attach public URL or uploaded `file_id` on user message (`input_file` / SDK `file(...)`).
- Implicitly enables **`attachment_search`** server tool → agentic doc Q&A.
- Multi-file, multi-turn (context persists when chaining).
- Combine with `code_interpreter` for analysis on attached data.
- Limits: **48 MB**/file; text-ish formats (txt, md, code, csv, json, pdf, …); agentic models only; no `n>1` batch fanout on these agentic file chats.
- Files API: upload / list / get / delete (`purpose` e.g. `assistants`).

### 7.3 Collections (persistent RAG)

- Create collection → upload docs → embeddings/chunking/metadata.
- Metadata: required/unique/inject_into_chunk for filtered retrieval.
- Tool: `collections_search` / Responses `file_search` with collection ids.
- Direct search API: `/v1/documents/search`.
- File can belong to multiple collections.

---

## 8. Image & video generation (Imagine)

Separate from chat, but batch/API-adjacent for harness side features.

| API | Purpose |
|-----|---------|
| `POST /v1/images/generations` | Text → image |
| `POST /v1/images/edits` | Edit; multi-image edit up to **3** refs |
| Video generation / edit / extension | Async poll patterns |

- Models: e.g. `grok-imagine-image-quality`, `grok-imagine-image`, `grok-imagine-video`, `grok-imagine-video-1.5`
- Image params: `prompt`, `n`, `aspect_ratio` (many presets + `auto`), `resolution` (`1k`|`2k`), `response_format` (`url`|`b64_json`)
- Flat per-image pricing; video per-second; signed URLs expire (~1h on batch results)
- Not the same as vision input on chat models

---

## 9. Prompt caching

- **Automatic** prefix caching on matching message prefixes.
- Sticky routing to raise hit rate:
  - Responses: body field **`prompt_cache_key`**
  - Chat Completions: header **`x-grok-conv-id`**
  - gRPC SDK: metadata `x-grok-conv-id`
- Hits require **byte-stable prefix**: only append; never edit/remove/reorder earlier messages.
- Reasoning models: must return **encrypted reasoning** (or use stateful `previous_response_id`) or cache misses.
- Usage: `cached_tokens` / `cached_prompt_text_tokens`; cached input priced lower (model tables).
- Agentic multi-step loops benefit heavily (stable growing prefix).

---

## 10. Context compaction

- **`POST /v1/responses/compact`**
- Input: full Responses-style `input` + **`model`** (can use cheaper/faster model for compact).
- Output: single item `{ type: "compaction", id, encrypted_content }` + usage (`dropped_message_count`, etc.).
- Next `POST /v1/responses`: put compaction item first, append new user turns **after** it only.
- Opaque blob — do not parse/edit/merge.
- Conversation must already fit context; compaction does not rescue over-limit requests.
- Re-compact later as chat grows again.
- xAI SDK: `client.chat.compact_context(...)` / in-place `chat.compact()`.
- REST also mentions `context_management` on create as parsed-but-not-yet-executed in places — **explicit compact endpoint is the supported path**.

No separate “memory product” beyond: store+`previous_response_id`, encrypted content, compaction, Collections, and client-side Grok Build memory flags (product CLI, not core API).

---

## 11. Batch & deferred

### Batch API

- Async queue; discount on **text** models (docs: ~20% on listed models); image/video at standard rates.
- Request types: chat completions, responses, image gen/edit, video gen/edit/extend.
- Inline SDK batch or **JSONL** upload via Files (max **200 MB**, **50k** lines); sealed after create.
- Per-request payload max **~25 MB**; `batch_request_id` / `custom_id` for correlation.
- Server-side tools + client function tools supported; client multi-turn tools need subsequent batch with results embedded.
- **`grok-4.5` not supported on Batch** (rejected) as of docs warning — use other models.
- Cancel/expire lifecycle; paginated results.

### Deferred chat completions

- Submit chat completion → `request_id` → poll `GET /v1/chat/deferred-completion/{id}`.
- **202** while pending; result retrievable **once** within **24h**.
- REST / xAI SDK (not general OpenAI deferred elsewhere).

---

## 12. Multi-agent research model

- Model ids: `grok-4.20-multi-agent` / `grok-4.20-multi-agent-0309` (+ aliases).
- Spawns **leader + sub-agents** (4 or 16 via effort / `agent_count`).
- Built-in server tools + remote MCP supported.
- **No client-side custom function tools** on multi-agent variant (as documented).
- Sub-agent internals encrypted unless `use_encrypted_content`.
- All leader+sub tokens and tool calls billed.
- Multi-turn via `previous_response_id`.

---

## 13. Models (agent-relevant snapshot)

| Model | Context | Notes |
|-------|---------|-------|
| `grok-4.5` | 500k | Flagship coding/agent; reasoning low/med/high (default high); aliases include `grok-build-latest` |
| `grok-4.3` | 1M | Effort control incl. possible `none` per REST |
| `grok-4.20-*-reasoning` / `*-non-reasoning` | 1M | Split reasoning variants |
| `grok-build-0.1` | 256k | Coding-oriented pricing tier |
| `grok-4.20-multi-agent-*` | 1M | Multi-agent research |
| Imagine / Voice models | — | Separate modalities |

- Long-context pricing tiers often kick in at **≥200k prompt tokens** (2×).
- Knowledge cutoff example: Grok 4.5 → **2026-02-01**.
- No realtime world knowledge without search tools.
- `logprobs` ignored on grok-4.20+.
- Role order unrestricted (system/user/assistant any sequence).

---

## 14. Auth, compatibility, ops

- Bearer API key; optional **management API key** in xAI SDK for admin features.
- OpenAI SDK compatibility for Responses + Chat Completions + many tool shapes (`code_interpreter`, `file_search`, `web_search`, `mcp`).
- Also available via **Google Cloud Vertex** partner models (`xai/grok-4.5`, etc.) OpenAI-compatible.
- **Priority processing:** higher priority tier (2× token multiplier); Chat/Responses only; not image/video/batch.
- Usage may include **`cost_in_usd_ticks`** / nano-USD fields for precise billing.
- Docs MCP server (meta): `https://docs.x.ai/api/mcp` for doc search by agents — not model inference.

---

## 15. Agent-harness feature checklist

| Feature | Support |
|---------|---------|
| Preferred chat API | **Responses** `POST /v1/responses` |
| Legacy chat | Chat Completions (function calling only for tools) |
| Stateful multi-turn | `previous_response_id` + 30d store; or encrypted content; or WS cache |
| ZDR / no store | `store: false` + encrypted reasoning/tool content; WS still chains in-memory |
| SSE streaming | Yes |
| WebSocket multi-turn | Yes (`/v1/responses`, ~25 min, warmup `generate:false`) |
| Client function tools | Yes; parallel; strict schemas; max tools ~128–200 |
| Server web search | Yes + domain filters, image search/understand |
| Server X search | Yes + handles, dates, media understand |
| Server code execution | Yes (`code_interpreter` / `code_execution`) |
| Server MCP | Yes (remote HTTP/SSE MCP) |
| Collections / file_search RAG | Yes |
| Chat file attachments | Yes → implicit `attachment_search` |
| Mix client + server tools | Yes (pause on client tools) |
| `max_turns` agent cap | Yes |
| Reasoning + effort | Yes (model-specific); encrypted + summaries |
| Structured outputs | `response_format` json_schema/object; strict tools |
| Prompt caching | Automatic + `prompt_cache_key` / `x-grok-conv-id` |
| Context compaction | `POST /v1/responses/compact` |
| Citations | List + inline + annotations |
| Vision input | Yes (jpeg/png) |
| Image/video generation | Imagine APIs |
| Batch | Yes (not all models; tools ok) |
| Deferred completion | Chat Completions poll path |
| Compaction / memory product | Compaction + store + Collections; no Anthropic-style managed memory API |
| Computer use / bash host tools | **Not** first-class hosted client tools like Anthropic; use your own function tools or MCP |

---

## 16. Practical notes for a coding agent

1. Prefer **`/v1/responses`** + streaming for any tool-using agent.
2. For local tool loops (edit files, shell): define **function tools**; use `previous_response_id` or encrypted content between turns; optional **WebSocket** for lower latency multi-step.
3. Optionally add server **`code_interpreter`**, **`web_search`**, **MCP** for docs/systems without hosting those yourself.
4. Always set **`prompt_cache_key`** (or conv id) for multi-turn cost/latency.
5. When context grows: **`/v1/responses/compact`** then continue; or rely on store chaining.
6. Use **`max_turns`** to bound runaway server-tool research inside one call.
7. For pure coding model selection: **`grok-4.5`** / build aliases; raise timeouts; set `reasoning.effort` to `low` when latency-bound.
8. Do not expect Chat Completions to run the full agentic server-tool loop — migrate to Responses.

---

## 17. Source map (docs.x.ai)

- Tools overview, function calling, web/X search, code execution, collections search, remote MCP, citations, streaming-and-sync, advanced hybrid usage, tool-usage-details (`max_turns`)
- Generate text / Responses, comparison vs Chat Completions, streaming, reasoning, structured outputs, multi-agent
- WebSocket mode, context compaction, prompt caching (+ multi-turn / maximizing hits)
- Files, Collections, image understanding, Imagine image/video
- Batch API, deferred chat completions, models, pricing, REST reference (`/v1/responses`, compact, chat)
- Release notes (Responses GA, compaction)

*Catalog drafted from public xAI docs research; verify limits/pricing against live docs before shipping.*
