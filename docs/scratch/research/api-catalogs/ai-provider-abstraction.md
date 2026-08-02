# Minimal AI provider abstraction

This is the practical synthesis of Vercel AI SDK, Mastra, and pi for a small personal coding-agent harness. It is not a general SDK design.

## Three approaches

### Vercel AI SDK: normalize provider calls

Vercel puts a common language-model contract over native provider APIs. Each adapter translates a standard prompt and tools into native requests, then translates native streams back into standard text, tool calls, usage, and finish reasons.

Its central lesson is the adapter boundary. Its complexity comes from promising broad compatibility: many model families, capabilities, metadata types, warnings, and provider-specific escape hatches.

**Keep:** provider-neutral invocation and stream events.

**Skip:** universal capability modeling and exhaustive normalization.

### Mastra: run agents above an existing model contract

Mastra mostly delegates provider normalization to Vercel. It adds model acquisition and an agent runtime: transcript persistence, tool loops, model selection, fallback, processors, tracing, and workflow behavior.

Its central lesson is ownership. Provider adapter handles one model invocation; agent runtime owns decisions across invocations. Its complexity comes from framework breadth, compatibility with several SDK generations, gateways, registries, and a large lifecycle event surface.

**Keep:** agent-owned transcript, tool loop, stop conditions, and accumulated result.

**Skip:** registries, gateways, workflow machinery, and universal agent events.

### pi: separate provider identity from wire protocol

Pi distinguishes a provider from the API protocol a model speaks. xAI and OpenRouter can reuse an OpenAI protocol adapter rather than requiring brand-specific implementations. Its agent depends on one injected streaming function, not the provider catalog or authentication system.

Pi also treats cross-model history as a conversion problem. Canonical messages remain portable while opaque reasoning signatures and response IDs carry an explicit provider/model scope.

Its central lesson is that protocol adapters are often the reusable unit. Its complexity comes from provider catalogs, authentication, discovery, and the inconsistent reality of “OpenAI-compatible” services.

**Keep:** protocol adapters, injected invocation function, and scoped replay metadata.

**Skip:** provider registry, model catalog, OAuth framework, and compatibility matrix until needed.

## Combined judgment

The smallest boundary that survives all three comparisons is a function:

```ts
type InvokeModel = (request: ModelRequest) => ModelStream;
```

Provider brands, model discovery, fallback, and agent behavior do not belong in this contract. Composition-root code selects a configured model and protocol adapter, then supplies an `InvokeModel` to the agent.

```text
explicit model configuration
        |
protocol adapter
        |
InvokeModel
        |
agent run: transcript, tools, steps, policy
```

## Proposed minimal contract

Exact request, stream, replay, cache, and failure findings live in `docs/scratch/model-call-abstraction.md`.

Construct `InvokeModel` with a fixed model target, resolved authentication, and protocol adapter. Per-call requests then contain only invocation data:

```ts
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

type ModelEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'tool-call'; id: string; name: string; input: unknown };

type ModelResult =
  | { type: 'success'; message: AssistantMessage; stopReason: StopReason; usage?: Usage }
  | { type: 'failure'; partial: AssistantMessage; error: ModelError };

interface ModelStream extends AsyncIterable<ModelEvent> {
  result(): Promise<ModelResult>;
}
```

`reasoning-delta` should be removed if the harness does not display reasoning. A non-streaming operation can collect this stream rather than requiring a second adapter method.

Canonical transcript initially needs ordered content blocks for:

- user and system text
- user and tool-result images
- assistant text and completed tool calls
- tool results paired by call ID
- narrowly scoped opaque metadata required to continue a supported model conversation

Partial tool JSON stays inside adapters. A tool-call event is emitted only after arguments are complete and parseable. Stream EOF without a native terminal event is failure, even when partial text exists.

## Responsibility boundary

Protocol adapter owns:

- canonical-to-native message and tool conversion
- native stream parsing
- buffering partial tool arguments
- stop reason and usage mapping
- validation of supported model options
- replay or removal of provider-scoped metadata
- transcript repairs required by its native API
- route-level cache hints and stateless reasoning replay

Agent owns:

- canonical transcript persistence
- tool validation and execution
- multi-step loop and step ceiling
- accumulated output and usage
- model switching and fallback policy
- retry policy across invocations, limited to failures before observable output

Composition root owns:

- model IDs, protocol selection, base URLs, and credentials
- constructing adapters
- choosing which model the agent receives

## Model scope without owning a model catalog

Use Models.dev as upstream reference for model IDs, provider availability, capabilities, limits, and pricing. Do not copy its full catalog into this framework. Support current OpenAI GPT-5.6, Anthropic Haiku/Sonnet/Opus, and xAI Grok 4.5 as explicit model data, not as closed type-level unions. Model IDs should remain opaque strings. Each configured target names only facts needed to invoke it:

```ts
interface ModelTarget {
  id: string;
  provider: string;
  protocol: string;
  baseUrl: string;
  authProfile: string;
  capabilities?: ModelCapabilities;
}
```

`ModelCapabilities` should contain only differences that change harness behavior, such as image input or reasoning control. A new model version should usually be one new data entry. It should require adapter code only when protocol behavior changes.

This stays general without becoming a universal catalog: open to new model IDs, deliberately closed to unimplemented protocols and capabilities.

## Authentication boundary

Detailed findings live in `docs/scratch/model-authentication-abstraction.md`.

Authentication sits between model selection and protocol invocation:

```text
ModelTarget
   -> CredentialManager resolves and refreshes authProfile
   -> RequestAuth { headers, optional baseUrl override }
   -> protocol adapter invocation
```

Use a small auth contract:

```ts
interface AuthProfile {
  login(interaction: AuthInteraction): Promise<Credential>;
  refresh(credential: Credential, signal?: AbortSignal): Promise<Credential>;
  toRequestAuth(credential: Credential): Promise<RequestAuth>;
}
```

API keys can use a simpler profile with no refresh. Credential storage owns persistence; auth profiles own provider-specific login and token exchange; protocol adapters own final request formatting.

OAuth cannot be treated as universally interchangeable with an API key. OpenAI subscription OAuth uses the ChatGPT Codex backend and a specialized Responses protocol, while Anthropic and xAI OAuth alter request authentication within their respective provider routes. Model target therefore names both protocol and auth profile rather than only `provider + model ID`.

## Hard rules for the first version

1. Support only protocols required by chosen models.
2. Fail on unsupported features; do not warn and silently drop them.
3. Keep provider options adapter-owned and call-scoped until a concrete feature needs finer scope.
4. Retry automatically only before observable stream output.
5. Never silently fail over a partially emitted response or tool call.
6. Keep partial tool JSON inside adapters; expose only completed calls.
7. Test supported model-handoff pairs instead of claiming universal transcript portability.
8. Add a registry or capability system only when explicit construction stops being enough.
9. Use stateless transcript replay first; do not depend on `previous_response_id`.
10. Require a native terminal event before returning success.

## Initial implementation shape

Start with Anthropic Messages, OpenAI Codex Responses, and xAI's OpenAI Responses implementation. Keep ordinary OpenAI API-key Responses support as a separate target if desired; it should not be confused with subscription OAuth.

Use SSE for Codex initially. Its WebSocket continuation is an optimization with session state and fallback complexity, not a requirement of the model-call boundary.

OpenAI-compatible Chat Completions and OpenRouter remain unnecessary until a required model or route depends on them. Main open question is whether all desired GPT-5.6 variants are exposed through the Codex subscription backend; auth entitlement and model availability must be tested rather than inferred from public API model names.
