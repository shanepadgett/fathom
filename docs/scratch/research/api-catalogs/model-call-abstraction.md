# Model call abstraction

Scope: one streamed model invocation for the three selected routes. Authentication, agent loops, and tool execution stay outside this boundary.

## Routes inspected

### OpenAI Codex route using OpenAI Responses

The subscription route is a specialized Responses endpoint:

```text
POST https://chatgpt.com/backend-api/codex/responses
Authorization: Bearer <access token>
chatgpt-account-id: <JWT account id>
originator: <client identity>
OpenAI-Beta: responses=experimental
```

The request shape used by both pi and OpenAI's Codex client contains:

- `model`, `instructions`, and typed `input` items
- function tools, `tool_choice`, and `parallel_tool_calls`
- `reasoning`, `text.verbosity`, and `include: ["reasoning.encrypted_content"]`
- `store: false`, `stream: true`, and a stable `prompt_cache_key`

Assistant history is replayed as Responses output items, not flattened into user text. Reasoning items must retain their opaque encrypted content. Function calls require both provider IDs: item ID and call ID. Function results pair with the call ID.

Codex supports SSE and a stateful WebSocket route at
`wss://chatgpt.com/backend-api/codex/responses`. The client sends
`{ type: "response.create", ...body }` and receives the same Responses event objects used by the
SSE parser. The prototype exposes SSE and WebSocket as explicit constructors.

The WebSocket stays owned by one constructed model and handles one request at a time. A compatible
next turn can send only the new input with connection-local `previous_response_id`; incompatible
requests replay the full canonical transcript. Missing previous-response state retries once with a
new connection and full context. Failure or cancellation closes the connection, while `Model.close()`
provides deterministic cleanup.

### Anthropic Messages

The route is:

```text
POST https://api.anthropic.com/v1/messages
Authorization: Bearer <OAuth access token>
anthropic-version: 2023-06-01
anthropic-beta: claude-code-20250219,oauth-2025-04-20,...
```

OAuth also requires Claude Code identity headers and a Claude Code identity system block. This is route/auth formatting, not canonical transcript content.

Messages requests contain:

- `model`, `system`, `messages`, `max_tokens`, and `stream: true`
- tools with `name`, `description`, and `input_schema`
- optional `tool_choice`
- adaptive or budget-based `thinking`, depending on model generation
- cache-control markers on stable prompt prefixes

Assistant output is an ordered list of text, thinking, redacted-thinking, and tool-use blocks. Thinking signatures must be replayed unchanged. Tool results are user-side `tool_result` blocks paired by `tool_use_id`; consecutive results can share one user message.

Anthropic streams named SSE events. Tool input arrives as partial JSON strings and may be invalid if output ends early. A tool call is safe to expose only after its content block closes and JSON parses successfully.

### xAI route using OpenAI Responses

Grok 4.5 uses:

```text
POST https://api.x.ai/v1/responses
Authorization: Bearer <OAuth access token>
```

Its useful request subset matches OpenAI Responses:

- typed `input` items and function tools
- `store: false`, `stream: true`
- `reasoning.effort` with `low`, `medium`, or `high`
- `include: ["reasoning.encrypted_content"]`
- stable `prompt_cache_key`

Reasoning cannot be disabled for Grok 4.5. xAI recommends a prompt cache key for conversational affinity. With `store: false`, encrypted reasoning items must be saved and replayed locally.

The shared OpenAI Responses encoder and stream parser can serve xAI. Route configuration still validates xAI's narrower reasoning values and image formats.

## Shared wire-level facts

All three routes can represent the harness transcript as four concepts:

1. user content: ordered text and images
2. assistant content: ordered text, reasoning, and tool calls
3. tool results paired to call IDs
4. opaque provider metadata needed to replay assistant output

All three stream:

- text deltas
- reasoning or summarized-reasoning deltas
- tool-call argument fragments
- terminal stop status and usage

The native event names and ordering differ. They should not escape the adapter.

## Canonical transcript

Keep ordered content blocks. A single assistant string plus detached tool calls loses ordering and cannot faithfully replay interleaved reasoning and tools.

```ts
type InputContent =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: string };

type AssistantContent =
  | { type: 'text'; text: string; replay?: ReplayMetadata }
  | { type: 'reasoning'; text: string; replay?: ReplayMetadata }
  | { type: 'tool-call'; id: string; name: string; input: unknown; replay?: ReplayMetadata };

type Message =
  | { role: 'user'; content: InputContent[] }
  | { role: 'assistant'; content: AssistantContent[]; route: string; model: string }
  | { role: 'tool'; callId: string; name: string; content: InputContent[]; isError: boolean };

interface ReplayMetadata {
  route: string;
  value: unknown;
}
```

`ReplayMetadata` is adapter-owned opaque data. Adapter may replay it only when route and model compatibility checks pass. Cross-route handoff keeps visible text and completed tool calls but drops incompatible reasoning signatures and native item IDs.

Base64 image data is enough for first version. Adapters validate target support and MIME type before sending. Anthropic accepts JPEG, PNG, GIF, and WebP in this path; xAI's documented Grok image path accepts JPEG and PNG. Unsupported images fail before network I/O.

## Invocation contract

Bind model target, resolved authentication, and protocol adapter when constructing the function. They should not be mutable fields on every request.

```ts
type InvokeModel = (request: ModelRequest) => ModelStream;

interface ModelRequest {
  systemPrompt?: string;
  transcript: Message[];
  tools?: ToolDefinition[];
  signal?: AbortSignal;
  maxOutputTokens?: number;
  reasoning?: 'low' | 'medium' | 'high';
  toolChoice?: 'auto' | 'none' | 'required';
  cache?: { key: string; retention: 'none' | 'short' };
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

type ModelEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'tool-call'; call: Extract<AssistantContent, { type: 'tool-call' }> };

interface ModelStream extends AsyncIterable<ModelEvent> {
  result(): Promise<ModelResult>;
}
```

Only completed tool calls appear as events. Partial tool JSON remains private to adapter. Text and reasoning deltas are observable immediately and also accumulate into final ordered assistant message.

`reasoning` is a small harness-level control because all selected targets support those three levels. Adapter maps it to native settings and rejects unsupported values. Do not add `off`: Grok 4.5 cannot disable reasoning. Codex-only levels such as `minimal`, `xhigh`, or `max` can remain route options until harness needs them.

`maxOutputTokens` is common even though Anthropic requires it and Responses treats it as optional. Anthropic adapter uses target default when request omits it. Codex adapter should omit native limit unless verified against subscription route.

Temperature should not be in first contract. It conflicts with Anthropic thinking modes and is unsupported with some reasoning models. No current coding-agent requirement needs it.

## Result and failure contract

```ts
type StopReason = 'stop' | 'length' | 'tool-use';

interface Usage {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
}

type ModelResult =
  | {
      type: 'success';
      message: Extract<Message, { role: 'assistant' }>;
      stopReason: StopReason;
      usage?: Usage;
    }
  | {
      type: 'failure';
      partial: Extract<Message, { role: 'assistant' }>;
      error: ModelError;
    };

interface ModelError {
  kind: 'aborted' | 'auth' | 'rate-limit' | 'invalid-request' | 'server' | 'network' | 'protocol';
  message: string;
  retryAfterMs?: number;
  outputObserved: boolean;
  cause?: unknown;
}
```

Usage fields are nullable in practice. Do not synthesize zero into “known zero.” Anthropic reports input and cache counts near stream start and cumulative output near stream end. Responses reports final usage on terminal response events.

Success requires a native terminal event:

- Responses: `response.completed` or supported `response.incomplete`
- Anthropic: final message state with a known stop reason

EOF without terminal state is a protocol failure, even if text was emitted. Preserve partial text and reasoning for display, but never persist incomplete tool-call scratch buffers as executable calls.

Map native stops narrowly:

- natural completion to `stop`
- token/output limit to `length`
- completed client tool calls to `tool-use`
- refusal, safety termination, failed response, abort, and unknown stop values to failure

Do not turn a refusal into normal assistant text merely because provider streamed text with it.

## Cache and continuation policy

Use local transcript replay for correctness:

- Codex: `store: false`, full input, encrypted reasoning replay
- xAI: `store: false`, full input, encrypted reasoning replay
- Anthropic: full messages with signed thinking replay

`cache.key` is a stable per-agent-run affinity key, not a server-side conversation ID. Codex and xAI map it to `prompt_cache_key`. Anthropic maps retention to cache-control markers and may use key only for supported affinity headers.

The Codex WebSocket adapter may use `previous_response_id` only on the same live connection and only
when the new canonical input has the exact previous input-plus-output prefix. This is an internal
compression: the full transcript remains the source of truth, and missing server state retries once
with full context. SSE and xAI always replay full input.

## Retry boundary

Disable SDK retries. A small invocation wrapper outside protocol encoding owns retry policy. Automatic retry is allowed only before any model event has escaped. Honor `Retry-After` within a bounded delay. Once text, reasoning, or a completed tool call is observable, return failure with `outputObserved: true`; never silently restart or switch models.

Transport fallback follows same rule. The prototype keeps Codex SSE and WebSocket constructors
explicit and does not silently switch between them.

## Route mapping

| Canonical concept | Codex using OpenAI Responses | Anthropic Messages | xAI using OpenAI Responses |
| --- | --- | --- | --- |
| system prompt | `instructions` | `system` after OAuth identity block | developer/system input item |
| user image | `input_image` data URL | base64 image source | `input_image` data URL |
| tool definition | OpenAI Responses function tool | `input_schema` tool | OpenAI Responses function tool |
| tool call | `function_call` | `tool_use` | `function_call` |
| tool result | `function_call_output` | user `tool_result` | `function_call_output` |
| reasoning replay | encrypted reasoning item | signed thinking/redacted block | encrypted reasoning item |
| cache hint | `prompt_cache_key` | `cache_control` markers | `prompt_cache_key` |
| terminal usage | terminal response event | message start/delta | terminal response event |

## Initial implementation decision

Implement two protocol cores and one thin specialization:

1. OpenAI Responses encoder/parser, configured first for xAI.
2. Anthropic Messages encoder/parser.
3. Codex adapters reusing OpenAI Responses item conversion and event parsing, but owning URLs,
   headers, request defaults, and transport selection.

The filenames expose that separation: `openai_responses.ts` and `anthropic_messages.ts` implement wire protocols; `model_adapters.ts` binds provider routes to those protocols.

`sse.ts` and `websocket.ts` own transport framing. `openai_responses_websocket.ts` owns only Codex
Responses WebSocket lifecycle and connection-local continuation compression.

Leave out durable server-stored conversations, built-in provider tools, structured output, grammar
tools, deferred tool loading, citations, service tiers, long cache retention, and temperature.

Minimum live demo checks per route:

- one required tool call emits once
- tool result round-trips by call ID
- provider continuation metadata returns on the second request
- second-turn text streams visibly
- both turns reach a terminal completion

Validated through `deno task demo` on 2026-07-28 with `gpt-5.6-sol`, `claude-sonnet-4-6`, and
`grok-4.5`. Codex completed through both WebSocket and SSE; Anthropic and xAI completed through SSE.
All four model/transport combinations ran the same two-turn tool round trip using Pi OAuth
credentials.
