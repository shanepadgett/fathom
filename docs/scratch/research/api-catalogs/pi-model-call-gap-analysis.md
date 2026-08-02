# Pi versus model-call prototype: retained analysis

Ephemeral research record for continuing architecture work without retaining Pi repository
exploration in conversation context.

## Scope and reference

- Prototype: `spikes/model-calls/`
- Pi reference, read only: `/Users/shanepadgett/.local/share/tau-agent/references/pi`
- Pi version inspected: package version `0.82.1`, commit `027a5847`
- Target providers/routes: OpenAI Codex subscription Responses SSE/WebSocket, Anthropic Messages,
  and xAI Responses.
- User does not want computer use or MCP. Do not create test files.

## Prototype state and live evidence

Prototype has a broad provider-native streaming seam:

- immutable `Model`; conversation-local `ModelSession`
- canonical text, image, file, reasoning, refusal, client tools, citations, usage and stops
- native tools, provider-scoped data, typed options, `additionalBody`, raw provider events and
  unknown native output preservation
- exact same-provider opaque replay and deliberate cross-provider degradation
- typed errors, cancellation, SSE, stateful Codex WebSocket continuation
- read-only Pi OAuth and optional xAI API-key authorization

`mise exec -- deno task --cwd spikes/model-calls check` passes. Full live matrix passed on
2026-07-29 with `gpt-5.6-sol`, `claude-sonnet-4-6`, and `grok-4.5`:

- four route/transport combinations: two-turn client function tool round trip
- structured output
- image input
- document input
- visible high reasoning
- cancellation
- hosted web search
- Anthropic web fetch and code execution
- xAI X search and code interpreter

Pi xAI OAuth returns empty HTTP 400 for tool-less generation. Supplying an inert function tool with
`tool_choice: "none"` makes structured/image/file/reasoning requests pass. Demo contains this
credential-route scaffold. `XAI_API_KEY` bypasses it.

See `spikes/model-calls/README.md` for implementation evidence and limits.

## Main conclusion from Pi comparison

Pi does not expose a broader provider-native feature set. Pi's canonical AI seam is narrower—text,
image, thinking, and client tool calls—but is much deeper in production compatibility, caching,
transport hardening, handoff repair, retries, and agent orchestration.

Prototype is ahead on:

- JSON-schema final output
- file/document inputs
- native hosted tools
- citations
- raw provider events
- unknown native block preservation
- xAI-specific hosted tools and typed stored-conversation fields

Pi is ahead on the items below.

## Pi API-layer behavior not yet proved or completed in prototype

### OpenAI custom grammar tools — real functional gap

Pi supports Responses `type: "custom"` tools with Lark or regex grammar constraints, streaming
`custom_tool_call` input and sending `custom_tool_call_output`. It falls back to function tools when
unsupported and has `prefer` versus `require` constrained-sampling semantics.

Relevant Pi source:

- `packages/ai/src/types.ts`, `ConstrainedSamplingConfig` around lines 458-484
- `packages/ai/src/api/constrained-sampling.ts`
- `packages/ai/src/api/openai-responses-shared.ts`
  - `convertResponsesTools`, around lines 344-380
  - `processResponsesStream`, around lines 416-732
  - custom tool message replay around lines 250-300

Prototype can pass a native custom definition but parses resulting calls only as opaque
`provider-content`; it cannot execute and return them through canonical tool loop. This should be a
first-class addition if grammar tools are desired.

### Strict constrained tool schemas

Pi's tool type supports:

- JSON-schema `strict: "prefer"`: enforce when provider/model supports it, otherwise fall back
- JSON-schema `strict: "require"`: fail before request if unavailable
- model compatibility flags for strict support
- Anthropic full schema only when strict; compatibility-safe `type/properties/required` otherwise

Relevant Pi source:

- `packages/ai/src/api/constrained-sampling.ts`
- `packages/ai/src/api/anthropic-messages.ts`, `convertTools` around lines 1286-1322
- `packages/ai/test/anthropic-eager-tool-input-compat.test.ts` (read-only evidence)

Prototype now applies require/prefer policy and live-proves strict calls on Anthropic and xAI.

### Anthropic eager tool input and interleaved thinking

Pi automatically emits per-tool `eager_input_streaming: true` when supported, otherwise uses legacy
fine-grained beta header. It also handles adaptive versus budget thinking, summarized versus omitted
display, interleaved-thinking beta for older models, redacted thinking, and effort through `max`.

Relevant Pi source:

- `packages/ai/src/api/anthropic-messages.ts`
  - options around lines 202-262
  - compatibility around lines 173-200
  - `shouldUseFineGrainedToolStreamingBeta` around line 1282
  - `convertTools` around lines 1286-1322

Prototype parses fragmented input and visible reasoning, but has not specifically requested/proved
eager input or a multi-phase interleaved thinking/tool loop.

### Deferred tool loading

Pi can keep tools deferred and introduce them at transcript-defined load points:

- Anthropic `defer_loading` and `tool_reference`
- OpenAI `tool_search_call` and `tool_search_output`
- `ToolResultMessage.addedToolNames` records tools made available by execution/extensions
- compatibility fallback sends all definitions where unsupported

Relevant Pi source:

- `packages/ai/src/utils/deferred-tools.ts`
- `packages/ai/src/types.ts`, `addedToolNames` around lines 414-430
- `packages/ai/src/api/openai-responses-shared.ts`, message conversion around lines 136-338
- `packages/ai/src/api/anthropic-messages.ts`, tool-result conversion around lines 1080-1113
- `packages/ai/test/deferred-tools.test.ts` (read-only evidence)

Prototype has no canonical dynamic-tool load marker or tool-search replay.

### Prompt-cache policy

Pi implements behavior rather than just fields:

- `none`, `short`, `long` retention
- OpenAI 24h retention and explicit cache mode
- prompt cache key clamping
- Anthropic cache markers on system prompt, final tool and conversation tail
- Anthropic one-hour TTL
- session-affinity headers
- cache read/write and one-hour write accounting
- cost calculation and live cache probes through tool loops

Relevant Pi source:

- `packages/ai/src/api/openai-responses.ts`, `buildParams` around lines 257-331
- `packages/ai/src/api/openai-prompt-cache.ts`
- `packages/ai/src/api/anthropic-messages.ts`, cache helpers around lines 49-73 and message/tool
  conversion near lines 1255-1319
- `packages/ai/test/anthropic-long-cache-retention-e2e.test.ts`
- `packages/coding-agent/test/sdk-codex-cache-probe-tool-loop.ts`

Prototype maps cache fields and parses usage but does not automatically place Anthropic breakpoints,
measure hit behavior, enforce key limits, or calculate cache cost.

### Tool-result images

Pi has live integration coverage for image-only and mixed text/image tool results across compatible
providers in `packages/ai/test/image-tool-result.test.ts`.

Prototype codecs and types support them but live demo used text tool results only.

### Cross-provider/model handoff repair

Pi handles edge cases beyond prototype proof:

- tool-call ID normalization and paired Responses item/call IDs
- same-provider different-model history
- signed/encrypted reasoning retained only for compatible model
- portable reasoning converted to text
- redacted reasoning dropped across models
- orphaned calls receive synthetic error tool results
- errored/aborted assistant turns are excluded from replay
- image downgrade for non-vision models

Relevant Pi source:

- `packages/ai/src/api/transform-messages.ts`
- `packages/ai/src/api/openai-responses-shared.ts`, message conversion around lines 136-338
- `packages/ai/test/cross-provider-handoff.test.ts`
- `packages/ai/test/openai-responses-reasoning-replay-e2e.test.ts`

Prototype has principled same-provider opaque replay and cross-provider degradation but no equivalent
live matrix or complete repair policy.

### Provider option behavior not live-proved in prototype

Pi applies model-aware behavior for service tier, Codex text verbosity, reasoning level mapping,
thinking omission, long cache retention, tool choices, temperature compatibility and max-token
clamping. Prototype exposes many corresponding options but has not live-proved each.

## Pi production adapter hardening absent from prototype

These are not model capabilities but matter before production:

- abortable provider retries honoring `Retry-After`
- retryable status/header policy and maximum requested delay
- request and WebSocket connect timeouts
- payload and response hooks
- generated model catalog and per-model compatibility flags
- Codex zstd request compression
- Codex `sse`, `websocket`, `websocket-cached`, and `auto` transport modes
- WebSocket TTL, idle cleanup, connection reuse and debug stats
- fallback to SSE on WebSocket connection limit, oversized messages or failures
- usage-based cost calculation including service-tier multipliers

Relevant Pi source:

- `packages/ai/src/utils/provider-retry.ts`
- `packages/ai/src/api/openai-codex-responses.ts`
- `packages/ai/src/types.ts`, `StreamOptions` around lines 116-198

Prototype does have explicit Codex SSE/WS, connection-local delta continuation, missing-state replay,
typed errors and cancellation. It lacks automatic transport fallback, compression, retry policy,
TTL and cost.

## Pi agent/session layer — do not move these into provider adapter

Pi implements above adapter:

- sequential or parallel tool execution
- schema validation before execution
- refusal to execute any call from a token-truncated response
- steering and queued follow-ups
- agent-level retry orchestration
- durable sessions, branching and summaries
- provider-independent client-side compaction
- file-operation-aware compaction
- output truncation with full-output preservation

Relevant Pi source:

- `packages/agent/src/agent-loop.ts`
- `packages/agent/src/harness/compaction/compaction.ts`
- `packages/agent/src/harness/session/`
- `packages/agent/src/harness/tools/`

Important correction: Pi does not use Anthropic server-side compaction/context editing as its core
strategy. It summarizes and compacts above provider seam. This supports keeping context policy out of
adapter while optionally adding provider-native compaction as an optimization later.

## Provider-native features prototype has but Pi AI seam lacks

Pi canonical `AssistantMessage.content` is only text, thinking and client tool calls. `Context`
accepts text/image user content and function-style tools. Pi's Anthropic parser only canonicalizes
text, thinking/redacted-thinking and `tool_use`; Pi's xAI provider delegates to generic OpenAI
Responses. No first-class canonical handling was found for:

- structured final output
- file/document input
- hosted web search
- Anthropic web fetch/code execution server blocks
- xAI X search/code interpreter
- citations
- arbitrary native provider events/output
- xAI stored conversation lifecycle

Prototype already proves representative instances of these and preserves unknown future families.

## Recommended direction

Do not copy Pi wholesale. Preserve prototype's broader native surface, then add Pi's depth in this
order:

1. OpenAI custom grammar call and result protocol
2. strict tool capability policy
3. Anthropic eager input and interleaved-tool live proof
4. deferred tool loading only if tool count/dynamic extensions justify it
5. real cache placement, retention and hit verification
6. cross-provider/model history repair and live matrix
7. retries, timeouts and Codex automatic transport fallback
8. parallel/mixed-tool orchestration above adapter

Context compaction, tool execution, steering and durable sessions belong in agent/session layer.
Provider-native compaction can remain an optional route optimization, not shared source of truth.

## Implementation follow-up — 2026-07-29

Implemented in the spike without test files:

- `Model.capabilities` carries only strict-schema, grammar, and eager-input support required by
  encoding.
- `ToolDefinition.constrainedSampling` carries semantic JSON-schema policy or grammar variants.
- `src/constrained_sampling.ts` is the shared policy resolver. Provider codecs remain responsible
  for wire shapes.
- Responses custom calls stream as canonical JSON tool deltas, finish as ordinary canonical tool
  calls, replay as `custom_tool_call`, and return through `custom_tool_call_output`.
- Unsupported grammar sampling falls back to the same function schema. Strict `require` fails before
  network I/O when capability says unavailable; `prefer` degrades.
- Anthropic emits `eager_input_streaming`, strict schemas, and cache markers at system/tool/tail
  breakpoints.
- `ModelRequest.cache` expresses `none`/`short`/`long`; codecs map it to provider policy and canonical
  usage retains cache read/write counts.
- Live demo scenarios now cover constrained tools, prompt caches, provider handoff, and image tool
  results.

New live evidence:

- Anthropic strict tool call, eager input, signed continuation, and post-tool adaptive reasoning:
  passed with 38 reasoning delta events.
- xAI strict tool call/result loop: passed with 30 reasoning delta events.
- Anthropic short cache: 4,833 write tokens then 4,825 read tokens.
- xAI short cache: 3,456 read tokens on repeated prefix.
- Anthropic and xAI image tool results: passed.
- Anthropic -> xAI and xAI -> Anthropic canonical tool-call handoffs: passed.
- Static check and lint pass. No test/spec files exist.

OpenAI grammar protocol now passes its complete call/result loop over both Codex SSE and WebSocket.
Initial full-matrix calls hit transient Codex server errors; every failed route/scenario passed on
individual rerun.

Deliberately still deferred:

- deferred tool loading: no demonstrated tool-count or extension need yet
- retries/automatic transport fallback: policy/lifecycle work, not provider capability proof
- broader malformed/orphaned history repair: direct Anthropic/xAI semantic handoff already passes;
  add repair only for a reproduced invalid-history case
- parallel tool execution, validation, steering, compaction, and durable sessions: agent layer

## Structural cleanup — 2026-07-29

Architecture audit found and fixed several boundary leaks after constrained-sampling work:

- Moved generic JSON narrowing/normalization to internal `src/json.ts`; provider codecs now use
  explicit `asJsonObject`, `asString`, `asFiniteNumber`, `isJsonObject`, and `omitUndefined` names.
- Renamed broad `tools.ts` to focused internal `constrained_sampling.ts` and removed it from public
  `mod.ts` exports.
- Moved continuation compatibility into shared `continuation.ts` instead of duplicating it in both
  codecs.
- Moved Pi credential-file and Claude Code identity handling to demo-only `demo_auth.ts`.
  Core `Authorizer` now returns headers only; required Anthropic system text is an explicit adapter
  option rather than authentication state.
- Made model tool capabilities required constructor metadata. Adapters no longer guess capabilities
  from model IDs or silently merge optimistic defaults; a future model catalog can supply them.
- Removed untyped `features: string[]` capability metadata.
- Normalized assistant `provider-content` to use `provider`, matching input provider content.
- Renamed canonical `CachePolicy` to `CachePreference` because provider caching cannot guarantee
  identical semantics.
- Replaced Responses boolean route switches and adapter post-build repair with an explicit internal
  route profile covering system placement, output-token support, conversations, cache retention,
  and stored responses. WebSocket-only removal of `stream` remains transport framing.
- Removed meaningless canonical `ToolDefinition.type?: "function"`; wire-level tool kinds belong to
  codecs.

`deno task check` now formats, lints, and type-checks core, demo, and demo auth. Anthropic and xAI
round-trip smoke checks still pass after cleanup. No test/spec files exist.

Simplify-review follow-up removed the canonical partial-tool event, unused session/model metadata,
unused transport/input/output capability metadata, duplicate provider cache key option, one-use fixed
authorizer and content-header wrappers, manual base64url decoder, and superseded build log. Tool JSON
fragments remain parser-private until a complete `tool-call`. Static checks and Anthropic/xAI live
round trips still pass.

Complete post-refactor live matrix was executed across all eleven scenarios and four routes.
Transient Codex failures were rerun successfully. New evidence includes custom grammar calls/results
on both Codex transports, 2,816 cache-read tokens on each Codex transport, image tool results on all
routes, and every provider as a cross-provider handoff destination. Anthropic constrained flow was
shortened after one valid but length-limited completion and then passed with `stop`.
