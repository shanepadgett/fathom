# Mastra: provider abstraction

Status: Mastra pass complete; ephemeral research notes.

## First finding: Mastra mostly builds above Vercel's boundary

Mastra does not independently normalize OpenAI, Anthropic, xAI, and other native APIs. It accepts Vercel AI SDK language-model objects and delegates provider-specific message conversion, tools, streaming, and response normalization to those objects.

Its added abstraction answers a different question: **how does an agent select, configure, and run one of those already-standardized models?**

```text
Agent.stream(...)
      |
Mastra agent loop, tools, memory, processors, tracing
      |
resolve model object or "provider/model" string
      |
Mastra model wrapper / model router
      |
Vercel LanguageModel doStream / doGenerate
      |
provider adapter and native API
```

Callers can supply either:

- An existing AI SDK `LanguageModel` object.
- A string such as `openai/gpt-4o`.
- An OpenAI-compatible endpoint configuration.
- A function that chooses one of those at request time.

Existing language-model objects receive thin Mastra wrappers. A model string creates a `ModelRouterLanguageModel`, which resolves provider package, authentication, endpoint, and model through a gateway, then calls the resulting AI SDK model.

## Initial judgment

This is useful separation. Vercel standardizes model behavior; Mastra standardizes model **acquisition and agent execution**. A personal harness can likely use provider adapters directly and skip most of Mastra's routing machinery.

Mastra's main cost is compatibility breadth. Core currently recognizes several generations of Vercel's language-model contract and wraps each one. Its router may resolve multiple gateway types, dynamically locate provider packages, cache model instances, manage authentication, and bridge stream versions. Those are distribution-framework concerns, not inherent requirements for talking to several providers.

## Early lesson for a personal harness

Keep model construction separate from the adapter contract, but start with explicit construction:

```ts
const model = openAIModel({ modelId, apiKey });
```

A `"provider/model"` registry becomes worthwhile only if runtime model switching or user-entered model names are real requirements. It should not be the foundation merely because Mastra supports it.

## Next pass

Trace what Mastra adds between `Agent.stream()` and the model stream: transcript ownership, tool loop, processors, and its normalized output. That is more relevant to a small agent harness than gateway discovery itself.

## Agent execution layer

`Agent.stream()` is not a thin call to the selected model. It prepares an execution run, then hands that run to a reusable loop:

```text
Agent.stream
  -> merge run options and resolve model
  -> prepare memory, instructions, tools, processors, and tracing
  -> create execution workflow
  -> run agent loop
  -> expose MastraModelOutput
```

The loop owns concerns that should remain above provider adapters:

- conversation and system-message state
- repeated model steps and stop conditions
- tool execution, concurrency, approval, suspension, and resumption
- model fallback
- input, output, and error processors
- memory persistence
- tracing and usage across steps

This validates the responsibility boundary extracted from Vercel. Provider adapters normalize one model invocation; agent runtime decides what to do with its result.

### Transcript ownership

Mastra has its own persistent `MastraDBMessage` representation managed by `MessageList`. It converts that format into whichever AI SDK message generation a selected model expects. This is more elaborate than Vercel's public-to-provider prompt conversion because Mastra must also serve storage, UI display, memory, suspension, and several AI SDK versions.

That extra canonical format is justified for Mastra, but most of its conversion layer is compatibility cost. A personal harness still benefits from one canonical transcript, but it does not need separate DB, UI, and multiple AI SDK representations unless those become distinct consumers.

Provider differences also leak above the nominal provider boundary when stored history is replayed or moved between models. Mastra has explicit fixes for examples such as:

- Gemini requiring a user message before an assistant message.
- Anthropic tool results needing original tool input restored.
- OpenAI structured output returning `null` where an optional schema expects `undefined`.

The useful lesson is not to build a global compatibility subsystem. Keep stored transcript provider-neutral, preserve only native metadata required for continuation, and place each known repair as close as possible to the adapter or feature that requires it.

### Stream and result surface

Mastra consumes the AI SDK model stream and emits a second, agent-level stream. Its events include model text and tool calls, but also tool execution, approval, suspension, processors, goals, background work, workflow state, and step boundaries.

`MastraModelOutput` then exposes both that stream and promises for collected text, tools, usage, finish reason, messages, and full output. This is convenient for a broad framework, but its event vocabulary reflects Mastra's entire product rather than the minimum model protocol.

### Smaller-harness decision

Use two intentionally different concepts:

1. Small provider event stream: text, completed tool call, finish, and only required reasoning events.
2. Agent run state: transcript, current step, tool execution, accumulated usage, and final result.

Do not create a second public stream protocol until the harness needs to expose non-model lifecycle events. Internally, the agent loop can consume provider events directly and update run state. If UI later needs tool-start or approval events, add those as agent events without expanding the provider contract.

Mastra's strongest lesson here is the separation itself. Its weakness for this project is how many framework features share the same execution and stream surface, making the simple path difficult to see.

## Next pass

Inspect model fallback, runtime model selection, and provider options only far enough to decide which configuration seams a personal harness should keep. Then close the Mastra pass with a compact minimal extraction.

## Runtime selection and fallback

Mastra permits model selection at several levels:

- fixed model object or `"provider/model"` string on agent
- per-call model override
- function that selects model using request context
- ordered list of models with per-model retries, settings, provider options, headers, and enabled state

For each step, Mastra retries configured model and then moves to next model when execution throws. Processor tripwires do not trigger fallback. Per-model settings and provider options are merged into call settings, and fallback model gets recorded in tracing and transcript step metadata.

This is a sensible framework policy, but most flexibility is configuration surface rather than model abstraction. Runtime selection ultimately produces same small thing: ordered list of already-resolved language models.

### Smaller-harness decision

Represent fallback directly in agent policy, not provider layer:

```ts
type ModelCandidate = {
  model: ModelAdapter;
  retries?: number;
};
```

Start with one fixed candidate. Add ordered fallback only after a concrete reliability need. Fall back on transport or provider failures, not arbitrary finish reasons or poor output. Content-based fallback needs explicit policy because it can duplicate cost and make behavior hard to explain.

Runtime model selection can be ordinary application code returning a candidate list. No registry, gateway manager, enabled flags, or dynamic configuration schema is needed for one owner.

Use clear option precedence rather than generic deep merging:

1. adapter/model defaults
2. agent defaults
3. call overrides

Provider-specific options remain one call-level adapter-owned object. Fixed model constraints should be validated by adapter rather than silently overriding caller intent.

## Authentication

Mastra's model acquisition layer resolves explicit API keys, environment variables, custom headers, and gateway-provided keys before constructing or calling an AI SDK model. It protects those values from serialized tracing output, but it does not provide provider subscription OAuth login and refresh as part of the language-model abstraction.

That placement is useful: credential acquisition belongs beside model acquisition, not inside agent loop. Mastra's gateway chain is broader than this harness needs, though. Three fixed providers do not require generic gateway auth resolution.

### Smaller-harness decision

Use a small credential manager at composition root. It chooses a stored API-key or OAuth credential, refreshes when needed, and produces request auth for selected model target. Agent and canonical transcript should know nothing about credential type.

## What Mastra contributes

Mastra's provider story is best understood as three layers:

1. **Vercel AI SDK model contract** normalizes provider APIs.
2. **Model resolver/router** acquires one of those models from objects, names, endpoints, or gateways.
3. **Agent runtime** owns durable transcript, tools, multi-step execution, processors, fallback, and agent-level output.

### Strengths

- Correctly keeps provider invocation below agent behavior.
- Accepts existing AI SDK models instead of forcing every provider through Mastra-owned adapters.
- Makes model selection and fallback request-aware without changing agent loop.
- Treats transcript, tool execution, and accumulated output as agent concerns.
- Handles persistence and suspend/resume as explicit runtime state.

### Costs

- Multiple AI SDK generations create wrappers and message conversion layers throughout core.
- Model strings, registries, gateways, package loading, authentication, capabilities, and caches make acquisition much larger than actual model contract.
- Agent stream vocabulary includes nearly every framework feature.
- Provider compatibility repairs and metadata leak into message/runtime code despite lower provider abstraction.
- Many overlapping defaults and overrides make effective request configuration harder to see.

## Minimal extraction

Mastra does not change provisional provider contract taken from Vercel. It strengthens agent-side boundary around it:

```text
explicitly constructed ModelAdapter
          |
small provider event stream
          |
AgentRun owns transcript + tool loop + accumulated result
```

Keep from Mastra:

- one canonical transcript owned by agent run
- provider-independent tool loop above adapter
- explicit stop condition and step count ceiling
- final result accumulated separately from live provider events
- optional ordered fallback as agent policy
- request-context model selection as plain application code, if needed

Leave out initially:

- string model registry and gateway discovery
- compatibility with several SDK contract generations
- DB/UI/model message adapters
- workflow engine for ordinary agent loop
- processor pipeline
- suspension, approval, background-task, and network events
- universal agent stream vocabulary
- dynamic capability registry

The strongest Mastra lesson is architectural, not reusable machinery: keep model invocation replaceable, while transcript and agent decisions remain stable above it.
