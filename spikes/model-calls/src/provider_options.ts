import { JsonObject } from "./types.ts";

export interface NativeRequestOptions {
  /** Future or uncommon route fields. Canonical model, input, messages, and stream fields win. */
  additionalBody?: JsonObject;
  /** Authentication, host, accept, and content-type cannot be overridden. */
  additionalHeaders?: HeadersInit;
}

export interface OpenAIResponsesOptions extends NativeRequestOptions {
  conversation?: string | { id: string };
  context_management?: Array<{ type: "compaction"; compact_threshold?: number }>;
  include?: string[];
  max_tool_calls?: number;
  prompt?: {
    id: string;
    variables?: JsonObject;
    version?: string;
  };
  reasoning?: {
    effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
    summary?: "auto" | "concise" | "detailed";
  };
  text?: JsonObject;
  parallel_tool_calls?: boolean;
  previous_response_id?: string;
  service_tier?: string;
  temperature?: number;
  top_p?: number;
  truncation?: "auto" | "disabled";
  prompt_cache_retention?: "in_memory" | "24h";
  prompt_cache_options?: { mode?: "implicit" | "explicit"; ttl?: "30m" };
  safety_identifier?: string;
  stream_options?: { include_obfuscation?: boolean };
  top_logprobs?: number;
  user?: string;
  metadata?: JsonObject;
  store?: boolean;
}

export interface OpenAICodexOptions extends OpenAIResponsesOptions {
  conversation?: never;
  previous_response_id?: never;
  /** Subscription route currently requires store=false. */
  store?: false;
}

export interface XaiResponsesOptions extends OpenAIResponsesOptions {
  include?: string[];
}

export interface AnthropicMessagesOptions extends NativeRequestOptions {
  thinking?:
    | { type: "adaptive"; display?: "summarized" | "omitted" }
    | { type: "enabled"; budget_tokens: number; display?: "summarized" | "omitted" }
    | { type: "disabled" };
  output_config?: {
    effort?: "low" | "medium" | "high" | "xhigh" | "max";
    format?: { type: "json_schema"; schema: JsonObject };
  };
  cache_control?: { type: "ephemeral"; ttl?: "5m" | "1h" };
  tool_choice?: JsonObject;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  service_tier?: "auto" | "standard_only";
  metadata?: { user_id?: string };
  container?: string;
  context_management?: JsonObject;
  mcp_servers?: JsonObject[];
  inference_geo?: string;
  betas?: string[];
}
