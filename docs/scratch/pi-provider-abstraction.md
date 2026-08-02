# pi: provider abstraction

Working notes for a measured comparison with Vercel AI SDK and Mastra. This is not a full package inventory.

## First finding: pi separates providers from wire protocols

Pi owns its abstraction rather than delegating it to Vercel AI SDK. Its useful distinction is:

- a **model** describes one model and names the API protocol it speaks;
- an **API implementation** knows one wire protocol, such as Anthropic Messages, OpenAI Responses, or OpenAI-compatible Chat Completions;
- a **provider** supplies identity, auth, base URL, model catalog, and one or more API implementations;
- a **Models collection** resolves auth and routes a selected model through its provider to the correct API implementation.

That means xAI and OpenRouter do not need mostly duplicated provider adapters. They reuse OpenAI protocol implementations. A mixed provider can dispatch different models through different protocols.

Conceptually:

```text
Models collection
  -> provider selected by model.provider
  -> API implementation selected by model.api
  -> canonical context converted to native request
  -> native stream converted to canonical events and final message
```

## Canonical boundary

The provider-facing input is one `Context`: optional system prompt, canonical messages, and TypeBox tools. Messages cover user content, assistant text/thinking/tool calls, and tool results.

Every text API implementation exposes the same two operations:

- `stream(model, context, provider-specific options)` for full control;
- `streamSimple(model, context, common reasoning options)` for portability.

Both return the same event stream. The stream is also the final-result handle: iteration yields text, thinking, and tool-call lifecycle events, while `result()` resolves to the completed assistant message. Setup and request failures become terminal stream events instead of sometimes throwing and sometimes streaming errors.

## Initial judgment

This is closer to the problem a small coding-agent harness has than Mastra. It treats provider and protocol as different facts and keeps the actual agent loop outside the AI package. It also makes cross-provider handoff a natural consequence of storing one canonical transcript.

The design has grown far beyond a personal harness: model catalogs, cost accounting, dynamic discovery, OAuth and credential storage, image generation, compatibility matrices, caching controls, multiple transports, and many provider-specific options. Those features explain much of the size; they are not required by the central abstraction.

## Early lesson for a personal harness

Keep pi's **protocol adapter** idea, but probably not its provider registry:

```text
Model = { id, provider, protocol }
ProtocolAdapter.stream(model, transcript, tools, options)
```

For a fixed set of models, provider auth and base URL can live in explicit model configuration or adapter construction. Separate `Provider` and `Models` objects only earn their keep if runtime model discovery, multiple auth methods, or user-selectable provider catalogs are real requirements.

Pi also pressure-tests the earlier proposed stream. Tool argument deltas and opaque reasoning/signature metadata are not theoretical: adapters need them to assemble tool calls and preserve provider continuity. They can remain adapter-owned until a completed canonical tool call or stored assistant message is produced.

## Next pass

Trace one OpenAI-compatible stream and one Anthropic stream through conversion, partial tool arguments, signatures, errors, and final usage. Then compare what pi's coding-agent loop actually consumes against the larger `pi-ai` surface.

## What the protocol adapters actually do

OpenAI-compatible and Anthropic streams follow the same shape despite different native events:

1. create an empty canonical assistant message;
2. convert canonical history and tools into native request data;
3. open the native stream;
4. mutate the partial canonical message as native blocks arrive;
5. buffer partial tool JSON inside adapter-only fields;
6. parse completed tool arguments and remove scratch fields;
7. map native stop reason and usage into the canonical message;
8. finish with exactly one `done` or `error` event.

OpenAI-compatible streaming needs maps by tool index and ID because providers do not all stream calls consistently. Anthropic can key blocks by native content index, but still accumulates `partial_json`. The common contract hides both mechanics from the agent loop.

Every incremental event includes both its delta and current partial assistant message. This makes UI and agent state replacement easy, at cost of a heavier event protocol. A personal harness can choose either this snapshot style or keep one accumulator in `AgentRun`; it does not need both.

## Continuity metadata is part of the transcript problem

Pi stores opaque provider data beside otherwise neutral content:

- thinking signatures for Anthropic and some OpenAI-compatible reasoning;
- thought signatures attached to tool calls;
- provider response IDs and resolved response model IDs.

Replay preserves signatures only when returning to same provider, protocol, and model. During cross-model handoff, private reasoning is converted to ordinary text or dropped, tool signatures are removed, and tool-call IDs may be normalized for destination protocol.

This is a better rule than pretending transcript is perfectly provider-free: canonical content stays portable, while opaque metadata has an explicit validity scope. Minimal harness should tag private replay metadata with adapter/model identity and let destination adapter decide whether it can reuse it.

Pi also repairs malformed history before provider conversion: unsupported images are downgraded, failed or aborted assistant turns are skipped, and missing tool results are synthesized. Some repair is necessary because persisted and interrupted agent sessions are not always ideal API transcripts. Keep these repairs centralized around transcript-to-provider conversion, not scattered through agent loop.

## What the agent loop really depends on

Pi's agent package does not depend on provider registry, auth resolution, model discovery, or API-specific options. Its LLM boundary is one injectable `StreamFn`:

```text
(model, context, simpleOptions) -> assistant event stream
```

`Models.streamSimple` happens to satisfy that function. Agent loop builds canonical context, consumes partial events, waits for final assistant message, executes completed tool calls, appends results, and repeats. Harness layer wraps the function only to add request hooks and common options.

This is strongest simplification found so far. Internal agent should depend on a function, not provider framework. Model/provider machinery can remain composition-root code outside loop.

## Smaller-harness decision

Likely keep:

- protocol adapters rather than one adapter class per brand;
- one canonical transcript with scoped opaque replay metadata;
- one injected streaming function as agent boundary;
- adapter-local tool JSON buffering and native stop/usage mapping;
- one final assistant message available from stream;
- transcript repair immediately before provider conversion.

Likely simplify:

- no runtime provider collection for a fixed model set;
- no full model catalog, dynamic refresh, cost table, OAuth framework, or compatibility detector;
- one common option surface plus explicit adapter options only where used;
- fewer lifecycle events unless UI needs block start/end boundaries;
- explicit model configurations instead of capability metadata broad enough to describe every model.

## Authentication

Pi is the only reference of the three with a complete provider-login boundary. A provider may expose API-key auth, OAuth, or both. OAuth supplies three operations: interactive login, refresh, and conversion of a valid credential into request auth. A credential store persists the tagged credential; auth resolution refreshes expiring tokens under the store lock and produces an API key, headers, and optionally a credential-specific base URL. Only then does model streaming begin.

This reveals an important distinction: OAuth is not always an alternate string for the same API.

- OpenAI subscription OAuth is modeled as a separate Codex provider using the ChatGPT backend and a Codex-specific Responses adapter.
- Anthropic Pro/Max OAuth reaches the Anthropic Messages adapter, which detects OAuth tokens and changes auth headers and beta flags.
- xAI subscription OAuth resolves to a bearer token used by its OpenAI Responses or Chat Completions adapters at the xAI endpoint.

Pi's `login / refresh / toAuth` split is worth keeping. Its provider catalog and generic ambient-auth system are not. For a small harness, an auth profile attached to each explicit model target can own those operations and return request-ready headers and endpoint overrides.

## Next pass

Inspect pi's actual model handoff and failure behavior, then make final strengths/costs comparison and tighten proposed minimal contract across all three references.

## Handoff is transcript conversion, not orchestration

Pi does not need a special handoff engine. Agent policy may replace selected model between turns; next adapter receives same canonical transcript and converts it for destination.

Destination conversion decides what survives:

- ordinary text, tool calls, and tool results remain canonical;
- same-model opaque signatures are replayed;
- cross-model private reasoning becomes ordinary text or is dropped when redacted;
- cross-model thought signatures are removed;
- tool-call IDs are normalized when destination protocol imposes different rules;
- failed and aborted assistant turns are excluded from later provider requests;
- orphaned tool calls receive synthetic error results so native history remains valid.

This makes switching models cheap at agent layer but puts real compatibility work in adapters. Pi has a broad live handoff test matrix because portable types alone do not prove portable history.

One caution: current README descriptions of cross-provider thinking and aborted-message replay do not fully match current conversion code. That drift is another cost of supporting many providers and compatibility rules. For a small harness, document rules beside conversion code and test only supported handoff pairs.

## Failure and retry boundaries

Pi uses one terminal shape for setup, auth, request, stream, and abort failures: final assistant message with partial content, partial usage, stop reason, and error text. Agent loop checks that message and stops before tool execution.

This consistency is valuable, but returning failures as messages means callers must remember to inspect `stopReason`. A discriminated `RunResult` would make accidental success handling harder while keeping partial assistant state.

Retry has two distinct scopes:

- protocol adapters retry retryable HTTP request establishment using status and retry headers;
- higher-level generated side jobs may retry completed error messages using policy and error classification.

Adapters disable SDK retries and own interruptible backoff. They do not transparently restart a stream after partial output, which avoids duplicate text and tool calls. Main agent loop itself terminates on provider error rather than silently retrying or changing model.

Smaller harness rule: retry only failures known to occur before observable output. Once a stream has emitted content, surface partial failure and let explicit agent/user policy decide whether to retry. Never automatically fail over a partially emitted tool call.

## Final judgment

### Strengths

- Best separation of provider identity from reusable wire protocol among three references.
- Canonical, serializable transcript is designed for actual model switching.
- Agent depends on one injected stream function rather than provider framework.
- Adapter contract covers streaming, tool arguments, reasoning continuity, usage, aborts, and errors without leaking native events.
- Agent loop owns tool execution and multi-turn behavior; AI package owns provider conversion.
- Real cross-provider tests acknowledge that compatibility is empirical.

### Costs

- Provider/model/auth/catalog layer is much larger than fixed personal harness needs.
- Canonical types contain many optional provider escape hatches and metadata fields.
- OpenAI-compatible path accumulates a large compatibility matrix because “compatible” endpoints differ materially.
- Full partial message on every event is convenient but heavier than necessary.
- In-band errors are uniform but easier to ignore than explicit result discrimination.
- Documentation and conversion behavior can drift as edge-case repairs evolve.

## Minimal extraction

For a tightly scoped coding agent, Pi suggests this boundary:

```text
type InvokeModel = (request: ModelRequest) => ModelStream

ModelRequest = {
  model,
  systemPrompt,
  transcript,
  tools,
  signal,
  options
}

ModelStream:
  async events: text delta | reasoning delta | completed tool call
  final result: success(final assistant message) | failure(partial assistant message, error)
```

Composition root selects protocol adapter from explicit model configuration and supplies credentials. Adapter converts transcript, buffers native tool input, preserves valid opaque metadata, and returns canonical output. Agent owns transcript persistence, tool execution, step loop, model switching, and retry policy.

Start with one adapter per protocol actually used: likely Anthropic Messages and one chosen OpenAI API. Add OpenAI-compatible Chat Completions only when a required model or OpenRouter route needs it. Do not begin with generic provider registration.
