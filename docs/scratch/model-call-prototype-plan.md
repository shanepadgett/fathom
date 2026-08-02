# Model-call prototype plan

## Purpose

Build a throwaway Deno prototype that answers one question: can a small agent-facing model contract support OpenAI Codex, Anthropic, and xAI without provider conditionals spreading into callers?

This is an architecture probe, not the first production package. Its useful output is a proven boundary and a list of places where that boundary fails.

## Success condition

One unchanged demo function sends the same text, tool definition, and tool result through each model:

```ts
await runDemo(openAICodexModel(...));
await runDemo(anthropicModel(...));
await runDemo(xaiModel(...));
```

Adding xAI after Codex and Anthropic must not require changes to demo code, canonical request types, or existing adapters. It may add a new adapter and private reusable OpenAI Responses protocol code. OpenRouter will be a later external test of the same boundary.

## Deliberate scope

Include:

- streaming text
- streaming reasoning when exposed by provider
- client-defined tools
- fragmented tool arguments
- tool-result round trip
- usage and stop reason
- opaque provider continuation data needed for the next turn
- cancellation
- clear protocol and authentication failures
- read-only reuse of existing Pi OAuth credentials

Exclude:

- OAuth login, refresh, and credential persistence
- agent loop and tool execution
- retries, fallback, and routing
- images
- provider-hosted tools
- structured output
- server-side conversation state
- model catalog and dynamic provider registry
- packaging and compatibility promises

Login is excluded because it tests credential lifecycle, not the model-call seam. The live demo reads Pi's existing OAuth credentials, while authentication remains an interface so a later owned OAuth implementation does not alter model or agent code. No API keys are required or supported by this prototype.

## Proposed public seam

```ts
interface Model {
  readonly id: string;
  stream(request: ModelRequest): AsyncIterable<ModelEvent>;
  close?(): void;
}
```

`ModelRequest` contains only concepts the future agent needs: system text, ordered transcript, tool definitions, cancellation, and a small reasoning control. Model ID, endpoint, protocol, and authentication are bound when constructing a model.

`ModelEvent` has four event kinds:

- text delta
- reasoning delta
- completed tool call
- terminal completion containing final assistant message, usage, and stop reason

Partial tool JSON never crosses the boundary. End-of-stream without a terminal completion is an error. Network and provider failures are thrown as a small typed `ModelError`; callers retain already-observed deltas.

The terminal event replaces the previously proposed `ModelStream.result()` side channel. One ordered channel is easier to consume and cannot disagree with a separate completion promise.

## Canonical transcript

Use ordered content blocks rather than a message string plus detached tool calls:

- user message: text blocks
- assistant message: text, reasoning, and completed tool-call blocks
- tool result: call ID, tool name, text result, and error flag

Assistant blocks may carry tagged opaque continuation data:

```ts
interface ContinuationData {
  owner: string;
  model: string;
  value: unknown;
}
```

Only the owning adapter may consume it, and only for a compatible model. Other adapters discard it while preserving visible text and completed tool calls. This keeps provider signatures and encrypted reasoning out of agent logic without pretending they are portable.

## Internal boundaries

### Model implementation

Owns model ID and coordinates auth, route, encoding, fetch, stream parsing, and native error mapping. Callers receive a constructed `Model`, not provider names used for runtime lookup.

### Protocol codec

Owns canonical/native message conversion and stream parsing. Start with:

- Anthropic Messages codec
- OpenAI Responses codec

`anthropic_messages.ts` and `openai_responses.ts` are protocol codecs. `model_adapters.ts` binds each provider route to one codec, its URL, headers, and defaults.

Codex and xAI get explicit model constructors. They may share the OpenAI Responses codec, but each constructor owns route URL, headers, and defaults. Do not expose a generic callback-filled provider configuration object; that would move provider spaghetti into configuration.

### Authorizer

```ts
interface Authorizer {
  requestAuth(signal?: AbortSignal): Promise<{ headers: HeadersInit }>;
}
```

Prototype implementation is a read-only Pi credential bridge. It reads `~/.pi/agent/auth.json` at
each HTTP invocation or WebSocket connection, selects the requested provider, and derives only the
request headers needed by that route.

It must:

- never print, trace, copy, persist, or return raw credentials
- never modify Pi's credential file
- never refresh a token, because refresh-token rotation could invalidate Pi's stored credential
- fail with an instruction to refresh or log in through Pi when the access token is expired
- validate credential shape and report missing providers without including secret values
- reject a credential file with group or world permissions rather than weakening Pi's storage boundary

Real credentials are read only by the explicitly invoked live demo. Deno tasks grant read access only to Pi's credential file and network access only to required provider hosts, not unrestricted `-A` permissions.

Future owned login, storage, refresh, and OpenRouter OAuth implementations can satisfy the same `Authorizer` interface.

### Transport

Use Deno's native `fetch` and unstable native `WebSocketStream`; add no transport dependency. Allow
private fetch injection for controlled HTTP callers. Keep SSE framing and JSON WebSocket framing in
small transport modules. Protocol codecs consume events without knowing which framing produced them.

## Construction, not registration

Expose concrete constructors:

```ts
openAICodexModel({ id, auth }): Model
openAICodexWebSocketModel({ id, auth }): Model
anthropicModel({ id, auth }): Model
xaiModel({ id, auth }): Model
```

There is no global registry, provider enum, model catalog, or string-to-adapter switch. Application composition chooses a constructor. Future OpenRouter support should be one new constructor and adapter with its OAuth `Authorizer` injected.

## Build sequence

1. Create Deno project under `spikes/model-calls/` with `check` and `demo` tasks.
2. Define canonical request, transcript, event, completion, and error types.
3. Add a read-only Pi credential reader and route-specific authorizers.
4. Implement shared SSE framing for split lines, split chunks, comments, and terminal EOF.
5. Implement Anthropic Messages encoding and stream parsing.
6. Implement the OpenAI Responses protocol for the Codex route.
7. Run the unchanged demo against Anthropic and Codex using unexpired Pi OAuth credentials.
8. Add xAI as the extensibility test. Reuse only OpenAI Responses protocol code that is genuinely identical; keep route behavior explicit.
9. Run the same demo against xAI using its Pi OAuth credential.
10. Record every core type changed while adding xAI. Any provider-only change to a public type triggers a boundary review.
11. Add explicit Codex WebSocket construction, persistent connection cleanup, and connection-local
    continuation without changing request, transcript, or event types.

## Runnable checks

Each adapter must demonstrate:

- a required tool call emits one parsed tool call
- tool result maps back to the original call ID
- continuation data can be submitted on a second request to the same route
- second-turn text streams visibly
- each turn reaches one completion event

The live demo exercises these behaviors against each provider.

## Boundary re-evaluation

### Rejected: provider plus model strings passed to one central client

This creates a switch that grows with every provider and encourages provider-specific options in one request type. Constructed `Model` objects keep selection at the composition root.

### Rejected: one universal provider adapter configuration

Codex and xAI both resemble Responses but differ in route and authentication behavior. A large options object with hooks would hide branches rather than remove them. Share private codecs, not provider identity.

### Rejected: resolved credentials bound permanently to a model

OAuth credentials expire. Bind an `Authorizer`, then resolve headers per HTTP invocation or physical
WebSocket connection. This permits refresh later without changing `Model`.

### Rejected: separate stream and result channels

`AsyncIterable` plus `result()` introduces lifecycle and synchronization rules. A required terminal event keeps ordering and completion in one channel.

### Rejected: fully provider-neutral continuation state

Reasoning signatures and native response items are not portable. Tagged opaque data states that truth and gives adapters a safe discard rule.

### Kept intentionally small

The request contract omits images, temperature, caching, retries, and arbitrary provider options. Add a common field only when agent behavior needs it across supported models. Add a constructor-specific option when only one route needs it. Never add an untyped provider-options escape hatch during the prototype.

## Final architectural test

Prototype passes if adding xAI changes only composition, xAI route code, and genuinely reusable Responses internals. Later, OpenRouter passes if it can add its constructor, protocol implementation, and OAuth authorizer without edits to agent-facing types.

If either provider requires agent-visible conditionals, stop and revise the boundary before turning this into a package.
