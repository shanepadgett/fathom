# Model Gateway & Routing Requirements

## 1. Provider Integration Layer (`pi-ai`)

- **Unified Provider Abstraction**: All connections to upstream LLM providers
  (Anthropic, OpenAI, Google Gemini, xAI Grok, local models) are managed via the
  `pi-ai` package.
- **Core Dependency**: `pi-ai` is part of the server foundation, not a removable
  plugin. Fathom uses its model and streaming contracts rather than maintaining
  a second provider abstraction.
- **Plugin Contributions**: Plugins register providers and models through the
  Fathom SDK's injected context, using `pi-ai` provider contracts. The server
  owns the provider collection; Cordis cleanup removes a plugin's registrations
  when it is unloaded.
- **Custom Gateways**: Provider plugins can supply custom endpoints,
  authentication, and static or dynamically fetched model catalogs. Compatible
  gateways reuse `pi-ai`'s existing API implementations.
- **Routing Policy**: Plugins can select models in the backend without a model
  selector in the UI. Connections and routing policy are replaceable; the
  underlying `pi-ai` foundation is not.
- **No Configured Providers**: The server can start without providers, but model
  requests are unavailable until a provider is configured.
- **Credential Separation**: Credentials stay securely in the backend store
  (e.g. `~/.pi/agent/auth.json` or system keychain) and never cross to the
  frontend.

---

## 2. Modes & Thinking Architecture (Status: Deferred Post-Scaffold)

### Thinking Levels

- **Delegated to `pi-ai`**: Fathom does not introduce custom thinking or
  reasoning budget mechanics.
- Clamping, validation, and provider-specific translation of thinking levels
  (`none`, `low`, `medium`, `high`, `xhigh`) are handled entirely by `pi-ai`'s
  native utilities (`clampThinkingLevel`, `getSupportedThinkingLevels`).

### Pluggable Modes System

- **Pure Plugin Construction**: Modes are not baked into the core runtime. They
  exist as an optional plugin (`plugin-modes`).
- **Clean Disablement**: If the plugin is disabled or omitted, Fathom functions
  as a straightforward, single-model coding harness by default. Other routing
  plugins can supply backend model selection without the modes plugin or a UI
  selector.
- **Provider-Aware Auto-Assignment**:
  - When enabled, the modes plugin discovers the user's currently authenticated
    providers in `~/.pi/agent/auth.json`.
  - Dynamically assigns appropriate models to built-in roles (e.g. assigning an
    available high-reasoning model to `planner`, fast model to `executor`).
- **Deferred Detailed Planning**: Granular mode transition rules, inter-mode
  history summarization, and custom persona builders are deferred until after
  the core product harness is scaffolded.

---

## 3. Native Image Generation (Multi-Modal Tooling)

- **Conditional Tool Exposure**:
  - The `generate_image` tool schema is exposed to the model only if the active
    provider and model support image generation via `pi-ai`.
  - Saves context token overhead when working with text-only models or
    providers.
- **Provider Paradigm Support**:
  - **Native Multimodal Generation**: OpenAI Responses API (`image_generation`
    tool / `image_generation_call`), Google Gemini (`models.generate_content`
    returning inline image parts via the Nano Banana family:
    `gemini-2.5-flash-image`, `gemini-3-pro-image`, `gemini-3.1-flash-image`).
  - **Dedicated Generation APIs**: xAI Grok Imagine API
    (`grok-imagine-image-2.0`, `grok-imagine-image-quality`), OpenAI Images API
    (`gpt-image-2`).
- **Asset Persistence & Storage**:
  - **Default Destination (Media Cache)**: Generated binaries are stored in the
    project session media cache
    (`~/.fathom/projects/<id>/media/<image-id>.<ext>`) to prevent repository
    clutter and keep SQLite databases lean.
  - **Explicit Destination Override**: When the user or agent specifies a
    destination directory or path (e.g. `public/assets/logo.png`), the tool
    saves the file directly to the specified workspace path.
  - **Timeline UI Preview**: In either destination mode, the generated image is
    emitted as a timeline card artifact with preview, copy, and export controls.

---

## 4. Tiered System Prompt Hierarchy

Models from different providers respond differently to system prompt styling,
formatting conventions, and instruction density. Fathom structures system
instructions hierarchically:

### 4.1 Resolution Hierarchy

1. **Model-Specific Overrides**:
   - Custom prompt templates targeting specific model identifiers (e.g.
     `claude-opus-5`, `gpt-6-astra`, `gemini-3.1-pro`).
   - Fine-tunes reasoning triggers, tool format conventions, or token economy.
2. **Provider-Level Defaults**:
   - Family-wide templates for `anthropic`, `openai`, `google`, `xai`, and
     `openrouter`.
   - Adapts to provider strengths (e.g. Anthropic XML tag structures, OpenAI
     conversational concise style).
3. **Universal Baseline Fallback**:
   - Core harness persona, pair-programming ethics, concise markdown output
     rules, and tool-use etiquette.
   - Applied for local models (Ollama/vLLM) or unrecognized upstream providers.

---

## 5. One-Off Model Invocations & Schema Architecture

Plugins, slash commands, guardrails, and internal subsystems often need to
execute out-of-band LLM requests without creating conversational transcript
turns or polluting the session tree.

### 5.1 The Unified `ModelService.complete()` API

Cordis `ModelService` exposes a high-level invocation method that handles
routing, credential injection, and telemetry attribution:

- **Credential & Routing Abstraction**: Plugins do not manage API keys or base
  URLs; `ModelService` routes requests through configured provider profiles.
- **Cost & Telemetry Attribution**: Every one-off call requires an `attribution`
  descriptor (e.g. `{ pluginId: "git", purpose: "commit_message", sessionId }`),
  ensuring all out-of-band token spend rolls up accurately into session and
  daily cost tracking.
- **Unified Signature**:
  - `model?: string`: Target model family (defaults to session or configured
    fast model).
  - `systemPrompt?: string`: Specialized task instructions.
  - `messages: ModelMessage[]`: Input prompt context.
  - `schema?: TSchema`: Schema constraining the output format.
  - `tools?: ToolDefinition[]`: Explicit tools made available for the call.
  - `toolChoice?: "auto" | "none" | "required" | { name: string }`: Execution
    constraint.

### 5.2 Structured Outputs vs. Tool Choice

- **Structured Output (`schema`)**: Guarantees the response is validated, typed
  JSON conforming to the supplied schema (via native OpenAI/Gemini JSON schema
  modes, or Anthropic forced tool calling).
- **Forced Tools (`tools` + `toolChoice`)**: Restricts the model to invoking
  specific tools with strictly validated arguments.
- **Combined Invocations**: A schema can be bound to a forced tool call,
  ensuring the generated tool payload strictly adheres to typed constraints.

### 5.3 Schema Engine: Standardized on TypeBox (`@sinclair/typebox`)

To eliminate fragile schema conversion layers and maximize performance across
providers:

- **Native JSON Schema**: Every TypeBox definition (`Type.Object(...)`) is a
  plain, compliant JSON Schema draft object at runtime with zero compilation
  overhead.
- **Zero Provider Conversion Friction**: Eliminates the failure modes,
  unsupported transforms, and bloat associated with `zod-to-json-schema`.
- **High Performance & Minimal Footprint**: TypeBox validates data 50x–100x
  faster than Zod with a tiny ~10 KB footprint and zero runtime dependencies.
- **Plugin Interoperability via `@standard-schema`**: The harness implements the
  TypeScript community `@standard-schema` specification, allowing third-party
  plugin authors to supply Zod, Valibot, or ArkType schemas if preferred, while
  TypeBox remains the native core standard.
