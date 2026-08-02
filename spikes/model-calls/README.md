# Model-call vertical slice

Streaming Deno prototype for four concrete model routes:

- OpenAI Codex subscription Responses over WebSocket
- OpenAI Codex subscription Responses over SSE
- Anthropic Messages over SSE
- xAI Responses over SSE

It probes a liftable agent-facing boundary, not a universal SDK. Common agent concepts are typed;
provider-native capabilities remain available without contaminating callers with protocol details.

## Run

Deno is pinned through Mise. Pi OAuth credentials are read from `~/.pi/agent/auth.json` without
being changed, refreshed, logged, or copied.

```sh
mise exec -- deno task --cwd spikes/model-calls check
mise exec -- deno task --cwd spikes/model-calls demo
mise exec -- deno task --cwd spikes/model-calls demo:all
```

`demo` defaults to the two-turn client-tool round trip. A scenario and optional case-insensitive
provider-label filter can be selected directly:

```sh
mise exec -- deno task --cwd spikes/model-calls demo structured Anthropic
mise exec -- deno task --cwd spikes/model-calls demo hosted-tool xAI
```

Scenarios are `round-trip`, `structured`, `image`, `file`, `hosted-tool`, `reasoning`,
`constrained-tool`, `cache`, `handoff`, `tool-image`, and `abort`. No test files exist; these
executable checks use live provider routes.

The xAI demo uses `XAI_API_KEY` when present and Pi OAuth otherwise. Current Pi xAI OAuth accepts
these feature requests only when a function-tool declaration is present, even with
`tool_choice: "none"`; tool-less requests return an empty HTTP 400. Demo adds that inert declaration
only for this credential route. Public API-key use does not need it.

## Boundary

```ts
const model = anthropicModel({
  id: "claude-sonnet-4-6",
  ...piAnthropicModelOptions(),
  toolCapabilities: {
    strictJsonSchema: true,
    grammar: false,
    eagerInput: true,
  },
});
const session = model.createSession();

try {
  for await (
    const event of session.stream({
      system: "Answer concisely.",
      transcript: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
    })
  ) {
    if (event.type === "text-delta") Deno.stdout.write(new TextEncoder().encode(event.text));
    if (event.type === "completion") console.log(event.completion.usage);
  }
} finally {
  session.close();
}
```

`Model` binds model ID, route, authentication, and protocol. `ModelSession` owns conversation-local
transport state. Requests contain an ordered transcript, client tools, hosted tools, cancellation,
reasoning level, cache preference, structured-output schema, token limit, and typed provider
options.

Canonical content supports text, images, files, refusals, reasoning, client tool calls, citations,
and unknown native blocks. Same-provider assistant output carries opaque continuation data for exact
replay. Cross-provider replay keeps portable text and client calls while dropping signed or
encrypted reasoning that another provider cannot consume.

Every native stream event is emitted as `provider-event`. Unknown output items are retained as
`provider-content`. This preserves new hosted-tool families before a canonical type exists.

## Capability escape hatches

Provider-specific behavior has three explicit levels:

1. `providerOptions` exposes stable route options with provider-specific TypeScript types.
2. `providerData` augments one content block or client tool definition for one provider.
3. `nativeTools` and `additionalBody` pass through native definitions and uncommon request fields.

Canonical and transport-owned fields win over escape-hatch data. Callers cannot override model,
input/messages, tools, stream mode, authentication, host, content type, or accepted event format.

Examples:

```ts
await session.stream({
  transcript,
  responseFormat: {
    type: "json-schema",
    name: "answer",
    schema: {
      type: "object",
      properties: { value: { type: "string" } },
      required: ["value"],
      additionalProperties: false,
    },
    strict: true,
  },
  nativeTools: [{
    provider: model.provider,
    definition: { type: "web_search" },
  }],
});
```

Stable provider options include OpenAI/xAI reasoning, prompt caching, service tier, truncation,
metadata, structured text, server conversation references, and context management; and Anthropic
thinking, output effort/schema, cache control, sampling, service tier, containers, context
management, MCP servers, inference geography, and beta headers.

## Constrained tools and caching

Tool definitions describe one semantic function contract. Optional constrained sampling adds either
JSON-schema strictness (`prefer` or `require`) or Lark/regex grammar variants.
`src/constrained_sampling.ts` resolves that intent against explicit model tool capabilities before
provider encoding:

- strict `require` fails before network I/O when unavailable
- strict `prefer` degrades to an ordinary function schema
- Responses grammar support uses custom-tool calls and custom-tool results
- other providers receive the same tool as an ordinary function tool
- grammar text is wrapped back into the tool's single required string property, so agent execution
  sees one JSON-shaped tool call on every provider

Model construction requires tool capabilities; adapters do not guess them from model names. A future
catalog can supply this metadata without coupling transcript, transport, or agent execution to that
catalog.

`cache: { retention: "none" | "short" | "long", key? }` is a provider-neutral preference. Codex maps
it to its bounded cache key, OpenAI-compatible public routes map retention fields, and Anthropic
places ephemeral markers on stable system content, final tool definition, and conversation tail.
Provider usage remains canonical `cacheRead`/`cacheWrite`; raw accounting stays in `usage.provider`.

## Live evidence

Validated with `gpt-5.6-sol`, `claude-sonnet-4-6`, and `grok-4.5` on 2026-07-29:

- all four routes complete a required client-tool call, replay its native assistant state, accept
  the matching tool result, stream second-turn text, and produce terminal usage/stop data
- Codex WebSocket reuses one physical connection and sends only the new input with
  `previous_response_id`; missing connection-local state reconnects once and replays full context
- JSON-schema output passes on every provider
- image input passes as base64 for Codex/Anthropic and URL for xAI
- document input passes as inline text for Codex/Anthropic and URL for xAI
- high reasoning produces visible summaries on every provider
- web search and citations pass on every provider
- Anthropic web fetch and code execution pass as native server tools
- xAI X search and code interpreter pass as native server tools
- already-aborted requests fail as typed `aborted` errors before output on every route
- Responses custom grammar tool calls and results pass over both Codex transports
- strict JSON-schema tools and tool-result continuation pass on Anthropic and xAI
- Anthropic eager tool input plus reasoning after a tool result pass in one signed continuation loop
- Codex prompt caching reports 2,816 read tokens over both transports
- Anthropic prompt caching reports 4,833 write tokens followed by 4,825 read tokens
- xAI prompt caching reports 3,456 read tokens on the repeated prefix
- image-bearing tool results pass on every route
- canonical cross-provider tool-call handoff passes with every provider as destination

Resource-backed tools are supported by native definitions but not fabricated in the demo: OpenAI
file/vector search, remote MCP, computer use, shell, image generation, and similar tools; Anthropic
MCP, tool search, computer use, and client-managed tool families; xAI collections search, MCP, and
uploaded-file IDs. Their external resources, approval loops, or client executors belong to the
application using this model seam.

## Route differences kept explicit

- Codex subscription forces `store: false`, rejects `max_output_tokens`, and does not expose public
  platform server-conversation options. Adapters filter those fields rather than weakening xAI.
- Anthropic OAuth requires Claude Code headers and identity system text. That requirement belongs to
  demo-only `piAnthropicModelOptions`; API-key authorization and core `Authorizer` do not inherit
  it.
- Anthropic client-tool input and server-tool input both arrive as fragmented JSON. Parser assembles
  them at content-block close; only client calls become executable `tool-call` events.
- xAI supports stored continuation through typed `store`, `previous_response_id`, and `conversation`
  options. Prototype defaults to local replay with `store: false` for privacy and portability.
- Responses hosted-tool output and Anthropic server blocks stay native, while final text citations
  are normalized as annotations.

## Failures and lifecycle

`ModelError` distinguishes abort, authentication, rate limit, invalid request, server, network, and
protocol failures. It carries status, provider code, request ID, retry delay, whether output
escaped, and a partial assistant message. EOF without a native terminal event is a protocol error.
Partial tool JSON is never exposed as an executable call.

WebSocket sessions reject concurrent streams because Responses WebSocket is sequential. Separate
conversations require separate sessions. HTTP sessions remain cheap but use the same lifecycle.

## Intentional ceiling

`ModelSession.stream()` covers one streamed inference turn. Background Responses, Batch, Realtime
audio, image/video generation endpoints, file upload/management, collections/vector-store
management, model catalogs, and provider administration have different lifecycle and data shapes.
They should be sibling clients sharing authorization and transport primitives, not optional fields
forced into this interface.

Prototype also does not own OAuth login/refresh, retries, fallback, routing, or tool execution.
Those are orchestration layers above this boundary. Moving to production requires owned credential
storage and refresh, deterministic codec checks in the production package, telemetry with secret
redaction, and route-specific integration checks.
