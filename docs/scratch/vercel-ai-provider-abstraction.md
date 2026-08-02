# Vercel AI SDK: provider abstraction

Status: Vercel pass complete; ephemeral research notes.

## Core approach

Vercel AI SDK puts a small provider contract between its high-level agent APIs and each provider's native HTTP API.

```text
generateText / streamText
        |
standard prompt, tools, and settings
        |
LanguageModelV4: doGenerate / doStream
        |
OpenAI, Anthropic, or another adapter
        |
provider-native HTTP API
```

Each adapter does both translations:

- Standard request into provider-native messages and options.
- Provider-native response or stream into standard content, tool calls, usage, finish reasons, warnings, and errors.

Provider factories mainly supply model identity, URL, authentication, and transport configuration. Calling `openai(modelId)` or `anthropic(modelId)` returns an object satisfying the same language-model contract.

## Design judgment so far

**Strong:** The provider boundary is concrete and small. Agent behavior such as retries, multi-step tool execution, and result assembly stays above it instead of being reimplemented by every provider.

**Cost:** A universal request shape cannot honestly hide provider differences. The SDK handles this with capability checks, warnings, provider-specific options and metadata, and substantial translation code. Anthropic's adapter is a clear example: its native reasoning, citations, server tools, and streaming events require much more normalization than basic text generation suggests.

## Likely lesson for a personal harness

Keep the adapter boundary, but define it from the few models and features the harness will use. Preserve a deliberate provider-specific escape hatch rather than expanding the common contract whenever one provider adds a feature.

Avoid copying Vercel's broad model-family contracts, compatibility layers, and exhaustive feature normalization unless a real harness use case requires them.

## Prompt and tool conversion

Vercel uses two provider-neutral message layers before reaching a native API:

1. Public `ModelMessage` values favor caller convenience.
2. `LanguageModelV4Prompt` is the stable contract consumed by provider adapters.

The second layer is a role-based transcript whose content is made from typed parts: text, files, reasoning, tool calls, and tool results. Conversion into it also validates conversation structure, including checking that client-executed tool calls have matching results.

This transcript earns its place because providers encode the same conversation differently. For example:

- OpenAI receives assistant tool calls followed by separate `tool` messages.
- Anthropic receives tool results as content inside a `user` message and treats its system prompt separately.

Tools follow the same pattern. Core code reduces a harness tool to a neutral definition—name, description, JSON input schema, and optional selection policy. Each adapter then reshapes that definition for its API. Provider-hosted tools remain explicitly provider-specific rather than pretending to be portable.

### Smaller-harness decision

Use one canonical transcript containing only roles and content parts the harness needs. At minimum that is likely:

- system and user text
- assistant text and tool calls
- tool results paired by call ID

Add files or reasoning only when a supported model needs them. Keep JSON Schema tool definitions and a small tool-choice union.

Do not copy Vercel's separate public and provider-level message formats unless this harness develops a public convenience API. With one owner and a tightly scoped caller, one canonical transcript can serve both agent state and adapter input.

## Streaming

Vercel makes streaming a provider contract rather than exposing native SSE chunks. Every adapter returns the same typed event stream. Its event vocabulary includes start, delta, and end events for text, reasoning, and tool input, plus completed tool calls, metadata, sources, files, errors, and a final usage and finish event.

This gives higher layers one stream-processing path regardless of provider. It also handles a real mismatch:

- OpenAI streams text and tool-call fields as partial deltas inside choices.
- Anthropic streams lifecycle events for indexed content blocks.

Both adapters must keep local state while translating. Partial tool arguments are especially important: they are accumulated by call ID or index and only become an executable tool call after the input is complete. Vercel deliberately does not execute as soon as partial JSON happens to parse because later chunks may extend it.

Vercel then applies another transform above the provider stream to validate tool inputs, assemble final content, collect timing, and expose its richer public stream. That second normalization is useful for a general SDK, but it duplicates concepts a personal harness can keep together.

### Smaller-harness decision

Use a small `AsyncIterable` event contract:

- `text-delta`
- completed `tool-call`
- `finish` with usage and finish reason

Add `reasoning-delta` only if reasoning must be displayed or preserved. Treat request setup failures and mid-stream failures as thrown errors unless the harness has a concrete need to render recoverable errors as data.

Keep partial tool-input buffering inside each provider adapter. Do not expose tool-input start/delta/end events unless the interface will display live tool arguments. Agent execution cannot safely use them early.

Start/end text events, raw chunks, response metadata events, sources, files, and provider-executed tool results can be added later if a supported workflow needs them. They should not be part of the initial common protocol.

## Capabilities and provider escape hatches

Vercel does not put a broad capability matrix on `LanguageModelV4`. The only notable declared input capability is which file URLs a model can consume directly. Most other decisions stay inside the adapter.

Adapters infer model behavior from model IDs and local tables. They use those facts to translate settings, choose fallbacks, clamp values, or emit warnings. Anthropic, for example, can emulate structured output with a forced JSON tool when native structured output is unavailable. Unknown models receive conservative defaults in some paths and forward-looking assumptions in others.

This avoids a central taxonomy that every provider must fit. Caller code asks for a feature and adapter decides how honestly it can provide it. The cost is hidden behavior: model-ID heuristics age quickly, warning-and-ignore behavior can make two nominally identical calls behave differently, and capability knowledge is scattered through provider code.

Provider-specific options and metadata are deliberate pressure-release valves. They are namespaced JSON records, such as `providerOptions.anthropic`, validated by adapter-owned schemas. Vercel permits them at call, message, content-part, and tool levels. This lets provider features ship without changing common contract, but also spreads escape hatches through nearly every neutral type.

### Smaller-harness decision

Do not build a public capability-discovery system. Keep a small model profile beside each adapter containing only facts that change harness behavior, such as:

- maximum output tokens
- reasoning support and parameter shape
- native structured-output support
- file or image input support

Fail when harness requests an unsupported feature rather than silently dropping it. Use a fallback only when behavior is equivalent enough for this harness and covered by a focused test.

Start with one call-level provider-options escape hatch, owned and validated by adapter. Add message-, part-, or tool-level options only for a real feature such as prompt caching that cannot be expressed at call level. Provider metadata can follow the same rule.

## Authentication

Vercel treats authentication as provider construction and request headers, not as a user-login subsystem. OpenAI loads an API key and emits a bearer header. Anthropic accepts either an API key or a pre-resolved bearer token. Custom headers and transport hooks can carry other credentials, but login, refresh, and secure storage remain caller responsibilities.

This is a clean model-adapter boundary: adapter should receive usable request authentication, not own an interactive OAuth flow. It is insufficient by itself for a harness centered on subscription OAuth because an access token may also require a different endpoint, headers, or protocol behavior.

### Smaller-harness decision

Keep OAuth acquisition and credential storage outside protocol adapter. Resolve a stored credential into request-ready auth immediately before invocation. Do not assume API key and OAuth differ only by header value.

## Next pass

Pressure-test these conclusions against Mastra rather than treating Vercel's architecture as the default.

## Provisional minimal contract

The smallest useful extraction from Vercel is a model adapter, not a large provider interface. Provider factories and registries are configuration conveniences outside the core contract.

```ts
interface ModelAdapter {
  readonly provider: string;
  readonly modelId: string;
  stream(request: ModelRequest): AsyncIterable<ModelEvent>;
}

interface ModelRequest {
  messages: Message[];
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required' | { tool: string };
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  providerOptions?: unknown;
}

type ModelEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; id: string; name: string; input: unknown }
  | { type: 'finish'; reason: FinishReason; usage: Usage };
```

`Message` is the single canonical transcript described above. `ToolDefinition` contains only name, description, and JSON input schema. Exact `Usage` and `FinishReason` fields should be chosen from actual harness needs.

One streaming primitive is enough initially. A non-streaming result can be produced by collecting its events. Separate `generate` and `stream` methods are justified only if a supported provider or harness path benefits from genuinely different HTTP behavior.

### Responsibility boundary

Adapter owns:

- native request and message conversion
- authentication and transport
- model-specific validation
- native stream parsing
- buffering partial tool arguments
- normalizing finish reason and usage

Agent harness owns:

- transcript state
- tool schema validation and execution
- multi-step loop
- retries and policy
- collecting text and completed calls into final step results

### Deliberately absent

- provider-wide model factories in core contract
- public capability discovery
- duplicate public and internal message formats
- separate non-streaming implementation
- warnings for silently ignored features
- raw native chunks and universal provider metadata
- embeddings, image, audio, and other unrelated model families

This is a starting hypothesis, not final SDK design. Mastra and pi should reveal whether any missing seam is doing necessary work rather than serving broad library compatibility.
