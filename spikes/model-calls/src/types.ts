export type JsonObject = Record<string, unknown>;

export interface Model<ProviderOptions = never> {
  readonly id: string;
  readonly provider: string;
  readonly capabilities: ModelToolCapabilities;
  createSession(): ModelSession<ProviderOptions>;
}

export interface ModelSession<ProviderOptions = never> {
  stream(request: ModelRequest<ProviderOptions>): AsyncIterable<ModelEvent>;
  close(): void;
}

export interface ModelToolCapabilities {
  readonly strictJsonSchema: boolean;
  readonly grammar: boolean;
  readonly eagerInput: boolean;
}

export interface ModelRequest<ProviderOptions = never> {
  system?: string;
  transcript: Message[];
  tools?: ToolDefinition[];
  nativeTools?: NativeTool[];
  signal?: AbortSignal;
  maxOutputTokens?: number;
  reasoning?: "low" | "medium" | "high";
  toolChoice?: "auto" | "none" | "required" | { name: string };
  cache?: CachePreference;
  responseFormat?: JsonSchemaFormat;
  providerOptions?: ProviderOptions;
}

export interface CachePreference {
  retention: "none" | "short" | "long";
  key?: string;
}

export type ConstrainedSampling =
  | { type: "json-schema"; strict: "prefer" | "require" }
  | { type: "grammar"; lark?: string; regex?: string };

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: JsonObject;
  constrainedSampling?: false | ConstrainedSampling;
  /** Fields merged into this tool for one provider. Canonical fields above win. */
  providerData?: Record<string, JsonObject>;
}

export interface NativeTool {
  provider: string;
  definition: JsonObject;
}

export interface JsonSchemaFormat {
  type: "json-schema";
  name: string;
  schema: JsonObject;
  description?: string;
  strict?: boolean;
}

export interface ContinuationData {
  provider: string;
  model: string;
  value: unknown;
}

interface ProviderScopedInput {
  /** Fields merged into the encoded content block for one provider. Canonical fields win. */
  providerData?: Record<string, JsonObject>;
}

export type InputContent =
  & ProviderScopedInput
  & (
    | { type: "text"; text: string }
    | { type: "image"; source: ImageSource; detail?: "auto" | "low" | "high" | "original" }
    | { type: "file"; source: FileSource; detail?: "auto" | "low" | "high" }
    | { type: "provider-content"; provider: string; data: JsonObject }
  );

export type ImageSource =
  | { type: "url"; url: string }
  | { type: "base64"; mediaType: string; data: string }
  | { type: "file"; id: string };

export type FileSource =
  | { type: "url"; url: string; filename?: string }
  | { type: "base64"; mediaType: string; data: string; filename?: string }
  | { type: "text"; text: string; filename?: string }
  | { type: "file"; id: string };

export interface ProviderAnnotation {
  type: string;
  data: JsonObject;
}

export type AssistantContent =
  | { type: "text"; text: string; annotations?: ProviderAnnotation[] }
  | { type: "reasoning"; text: string }
  | { type: "refusal"; text: string }
  | { type: "tool-call"; id: string; name: string; input: unknown }
  | { type: "provider-content"; provider: string; data: JsonObject };

export interface AssistantMessage {
  role: "assistant";
  content: AssistantContent[];
  continuation?: ContinuationData;
}

export type Message =
  | { role: "user"; content: InputContent[] }
  | AssistantMessage
  | { role: "tool"; callId: string; name: string; content: InputContent[]; isError: boolean };

export interface Usage {
  input?: number;
  output?: number;
  total?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
  provider?: JsonObject;
}

export type StopReason =
  | "stop"
  | "length"
  | "tool-use"
  | "refusal"
  | "content-filter"
  | "context-limit"
  | "pause";

export interface Completion {
  id?: string;
  message: AssistantMessage;
  stopReason: StopReason;
  usage?: Usage;
  providerData?: JsonObject;
}

export type ModelEvent =
  | { type: "provider-event"; provider: string; event: JsonObject }
  | { type: "text-delta"; index: number; text: string }
  | { type: "reasoning-delta"; index: number; text: string }
  | { type: "tool-call"; index: number; call: Extract<AssistantContent, { type: "tool-call" }> }
  | { type: "completion"; completion: Completion };

export type ModelErrorKind =
  | "aborted"
  | "auth"
  | "rate-limit"
  | "invalid-request"
  | "server"
  | "network"
  | "protocol";

export class ModelError extends Error {
  readonly kind: ModelErrorKind;
  readonly outputObserved: boolean;
  readonly partial: AssistantMessage;
  readonly retryAfterMs?: number;
  readonly status?: number;
  readonly providerCode?: string;
  readonly requestId?: string;

  constructor(
    kind: ModelErrorKind,
    message: string,
    options: {
      outputObserved?: boolean;
      partial?: AssistantMessage;
      retryAfterMs?: number;
      status?: number;
      providerCode?: string;
      requestId?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ModelError";
    this.kind = kind;
    this.outputObserved = options.outputObserved ?? false;
    this.partial = options.partial ?? { role: "assistant", content: [] };
    this.retryAfterMs = options.retryAfterMs;
    this.status = options.status;
    this.providerCode = options.providerCode;
    this.requestId = options.requestId;
  }
}

export interface Authorizer {
  requestAuth(signal?: AbortSignal): Promise<{ headers: HeadersInit }>;
}

export type Fetch = typeof globalThis.fetch;
