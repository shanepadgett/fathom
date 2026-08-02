import { compatibleContinuation } from "./continuation.ts";
import { resolveStrictSampling } from "./constrained_sampling.ts";
import { asFiniteNumber, asJsonObject, asString, isJsonObject, omitUndefined } from "./json.ts";
import { AnthropicMessagesOptions } from "./provider_options.ts";
import { parseSse } from "./sse.ts";
import {
  AssistantContent,
  AssistantMessage,
  Completion,
  FileSource,
  ImageSource,
  InputContent,
  JsonObject,
  ModelError,
  ModelEvent,
  ModelRequest,
  ModelToolCapabilities,
  StopReason,
  Usage,
} from "./types.ts";

type Json = JsonObject;

export function buildAnthropicMessagesBody(
  request: ModelRequest<AnthropicMessagesOptions>,
  provider: string,
  model: string,
  requiredSystemPrompt: string | undefined,
  toolSupport: ModelToolCapabilities,
): Json {
  const options = request.providerOptions ?? {};
  const cacheControl = request.cache
    ? anthropicCacheControl(request.cache.retention)
    : options.cache_control;
  const messages: Json[] = [];
  for (const message of request.transcript) {
    if (message.role === "user") {
      appendMessage(
        messages,
        "user",
        message.content.map((block) => anthropicInput(block, provider)),
      );
      continue;
    }
    if (message.role === "tool") {
      appendMessage(messages, "user", [{
        type: "tool_result",
        tool_use_id: message.callId,
        content: message.content.map((block) => anthropicInput(block, provider)),
        is_error: message.isError,
      }]);
      continue;
    }

    const replay = compatibleContinuation(message.continuation, provider, model);
    if (Array.isArray(replay)) {
      appendMessage(messages, "assistant", replay);
      continue;
    }
    const content: unknown[] = [];
    for (const block of message.content) {
      if (block.type === "text") content.push({ type: "text", text: block.text });
      if (block.type === "tool-call") {
        content.push({ type: "tool_use", id: block.id, name: block.name, input: block.input });
      }
      if (block.type === "provider-content" && block.provider === provider) {
        content.push(block.data);
      }
      // Anthropic requires signed thinking blocks. Unsigned cross-provider reasoning is omitted.
    }
    appendMessage(messages, "assistant", content);
  }

  const system = [
    ...(requiredSystemPrompt
      ? [{ type: "text", text: requiredSystemPrompt, cache_control: cacheControl }]
      : []),
    ...(request.system
      ? [{ type: "text", text: request.system, cache_control: cacheControl }]
      : []),
  ];
  cacheAnthropicTail(messages, cacheControl);
  const body: Json = {
    ...options.additionalBody,
    model,
    messages,
    max_tokens: request.maxOutputTokens ?? 4096,
    stream: true,
    system: system.length ? system : undefined,
  };
  for (
    const key of [
      "thinking",
      "temperature",
      "top_p",
      "top_k",
      "stop_sequences",
      "service_tier",
      "metadata",
      "container",
      "context_management",
      "mcp_servers",
      "inference_geo",
    ] as const
  ) {
    if (options[key] !== undefined) body[key] = options[key];
  }
  if (!options.thinking && request.reasoning) {
    body.thinking = { type: "adaptive", display: "summarized" };
  }
  const outputConfig = {
    ...options.output_config,
    ...(request.reasoning && !options.output_config?.effort ? { effort: request.reasoning } : {}),
    ...(request.responseFormat && !options.output_config?.format
      ? { format: { type: "json_schema", schema: request.responseFormat.schema } }
      : {}),
  };
  if (Object.keys(outputConfig).length) body.output_config = outputConfig;

  const canonicalTools = (request.tools ?? []).map((tool) => {
    const strict = resolveStrictSampling(tool, toolSupport);
    const schema = tool.inputSchema;
    const legacySchema = {
      type: "object",
      properties: schema.properties ?? {},
      required: schema.required ?? [],
    };
    return omitUndefined({
      ...tool.providerData?.[provider],
      name: tool.name,
      description: tool.description,
      input_schema: strict ? { ...schema, ...legacySchema } : legacySchema,
      strict: strict || undefined,
      eager_input_streaming: toolSupport.eagerInput || undefined,
    });
  });
  if (canonicalTools.length && cacheControl) {
    canonicalTools.at(-1)!.cache_control = cacheControl;
  }
  const tools = [
    ...canonicalTools,
    ...(request.nativeTools ?? [])
      .filter((tool) => tool.provider === provider)
      .map((tool) => tool.definition),
  ];
  if (tools.length && request.toolChoice !== "none") {
    body.tools = tools;
    body.tool_choice = options.tool_choice ?? anthropicToolChoice(request.toolChoice);
  } else {
    delete body.tools;
    delete body.tool_choice;
  }
  return omitUndefined(body);
}

type Block = {
  index: number;
  kind: "text" | "reasoning" | "tool" | "native";
  block: AssistantContent;
  native: Json;
  json?: string;
  signature?: string;
};

export async function* parseAnthropicMessagesStream(
  body: ReadableStream<Uint8Array>,
  provider: string,
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<ModelEvent> {
  const blocks: Block[] = [];
  const slots = new Map<number, Block>();
  const usage: Usage = {};
  let observed = false;
  let stopReason: StopReason | undefined;
  let messageId: string | undefined;
  let providerData: Json = {};

  const partial = (continuation = false): AssistantMessage => ({
    role: "assistant",
    content: blocks.map((block) => block.block),
    ...(continuation
      ? { continuation: { provider, model, value: blocks.map((block) => block.native) } }
      : {}),
  });
  const fail = (message: string, cause?: unknown): ModelError =>
    new ModelError("protocol", message, { outputObserved: observed, partial: partial(), cause });

  try {
    for await (const frame of parseSse(body, signal)) {
      let event: Json;
      try {
        const parsed = JSON.parse(frame.data) as unknown;
        if (!isJsonObject(parsed)) throw new Error("event is not an object");
        event = parsed;
      } catch (error) {
        throw fail("Anthropic stream contained invalid JSON", error);
      }
      yield { type: "provider-event", provider, event };

      const type = asString(event.type || frame.event);
      const index = asFiniteNumber(event.index) ?? 0;
      if (type === "message_start") {
        providerData = asJsonObject(event.message);
        messageId = asString(providerData.id) || undefined;
        mergeUsage(usage, asJsonObject(providerData.usage));
      } else if (type === "content_block_start") {
        const native = asJsonObject(event.content_block);
        const block = startBlock(blocks.length, native, provider);
        blocks.push(block);
        slots.set(index, block);
      } else if (type === "content_block_delta") {
        const delta = asJsonObject(event.delta);
        const block = slots.get(index);
        if (!block) continue;
        if (delta.type === "text_delta" && block.block.type === "text") {
          const text = asString(delta.text);
          block.block.text += text;
          block.native.text = asString(block.native.text) + text;
          observed ||= text.length > 0;
          yield { type: "text-delta", index: block.index, text };
        } else if (delta.type === "citations_delta" && block.block.type === "text") {
          const citation = asJsonObject(delta.citation);
          block.block.annotations ??= [];
          block.block.annotations.push({
            type: asString(citation.type) || "citation",
            data: citation,
          });
          const citations = Array.isArray(block.native.citations) ? block.native.citations : [];
          block.native.citations = [...citations, citation];
        } else if (delta.type === "thinking_delta" && block.block.type === "reasoning") {
          const text = asString(delta.thinking);
          block.block.text += text;
          block.native.thinking = asString(block.native.thinking) + text;
          observed ||= text.length > 0;
          yield { type: "reasoning-delta", index: block.index, text };
        } else if (delta.type === "signature_delta" && block.kind === "reasoning") {
          block.signature = (block.signature ?? "") + asString(delta.signature);
          block.native.signature = block.signature;
        } else if (delta.type === "input_json_delta" && block.kind === "tool") {
          const json = asString(delta.partial_json);
          block.json = (block.json ?? "") + json;
          observed ||= json.length > 0;
        } else if (delta.type === "input_json_delta" && block.kind === "native") {
          block.json = (block.json ?? "") + asString(delta.partial_json);
        }
      } else if (type === "content_block_stop") {
        const block = slots.get(index);
        if (block?.kind === "tool" && block.block.type === "tool-call") {
          if (block.json) {
            try {
              block.block.input = JSON.parse(block.json);
            } catch (error) {
              throw fail("Anthropic tool call ended with invalid JSON", error);
            }
          }
          block.native.input = block.block.input;
          observed = true;
          yield { type: "tool-call", index: block.index, call: block.block };
        } else if (block?.kind === "native" && block.json) {
          try {
            block.native.input = JSON.parse(block.json);
          } catch (error) {
            throw fail("Anthropic server tool ended with invalid JSON", error);
          }
        }
      } else if (type === "message_delta") {
        mergeUsage(usage, asJsonObject(event.usage));
        const delta = asJsonObject(event.delta);
        stopReason = anthropicStop(asString(delta.stop_reason));
        providerData = { ...providerData, ...delta, usage: usage.provider };
      } else if (type === "error") {
        const native = asJsonObject(event.error);
        throw new ModelError("server", asString(native.message) || "Anthropic route failed", {
          outputObserved: observed,
          partial: partial(),
          providerCode: asString(native.type) || undefined,
        });
      } else if (type === "message_stop") {
        if (!stopReason) throw fail("Anthropic stream stopped without a known stop reason");
        const completion: Completion = {
          id: messageId,
          message: partial(true),
          stopReason,
          usage: Object.keys(usage).length ? usage : undefined,
          providerData,
        };
        yield { type: "completion", completion };
        return;
      }
    }
  } catch (error) {
    if (error instanceof ModelError) {
      throw new ModelError(error.kind, error.message, {
        outputObserved: observed || error.outputObserved,
        partial: observed ? partial() : error.partial,
        retryAfterMs: error.retryAfterMs,
        status: error.status,
        providerCode: error.providerCode,
        requestId: error.requestId,
        cause: error,
      });
    }
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw new ModelError("aborted", "Model stream was aborted", {
        outputObserved: observed,
        partial: partial(),
        cause: error,
      });
    }
    throw fail("Anthropic stream failed", error);
  }
  throw fail("Anthropic stream ended before a terminal message event");
}

function anthropicInput(block: InputContent, provider: string): Json {
  const native = block.providerData?.[provider] ?? {};
  if (block.type === "text") return { ...native, type: "text", text: block.text };
  if (block.type === "provider-content") {
    return block.provider === provider ? block.data : {
      type: "text",
      text: JSON.stringify(block.data),
    };
  }
  if (block.type === "image") {
    return {
      ...native,
      type: "image",
      source: anthropicSource(block.source),
    };
  }
  return { ...native, type: "document", source: anthropicSource(block.source) };
}

function anthropicSource(source: ImageSource | FileSource): Json {
  if (source.type === "url") return { type: "url", url: source.url };
  if (source.type === "base64") {
    return { type: "base64", media_type: source.mediaType, data: source.data };
  }
  if (source.type === "text") return { type: "text", media_type: "text/plain", data: source.text };
  return { type: "file", file_id: source.id };
}

function appendMessage(messages: Json[], role: "user" | "assistant", content: unknown[]): void {
  if (!content.length) return;
  const previous = messages.at(-1);
  if (previous?.role === role && Array.isArray(previous.content)) {
    previous.content.push(...content);
  } else {
    messages.push({ role, content });
  }
}

function anthropicCacheControl(retention: "none" | "short" | "long"): Json | undefined {
  if (retention === "none") return undefined;
  return { type: "ephemeral", ...(retention === "long" ? { ttl: "1h" } : {}) };
}

function cacheAnthropicTail(messages: Json[], cacheControl: Json | undefined): void {
  if (!cacheControl) return;
  const message = messages.findLast((candidate) => candidate.role === "user");
  const content = message && Array.isArray(message.content) ? message.content : undefined;
  const block = content?.at(-1);
  if (isJsonObject(block)) block.cache_control = cacheControl;
}

function anthropicToolChoice(value: ModelRequest["toolChoice"]): Json {
  if (typeof value === "object") return { type: "tool", name: value.name };
  if (value === "required") return { type: "any" };
  return { type: "auto" };
}

function startBlock(index: number, native: Json, provider: string): Block {
  if (native.type === "text") {
    return {
      index,
      kind: "text",
      block: { type: "text", text: asString(native.text) },
      native: { ...native },
    };
  }
  if (native.type === "thinking" || native.type === "redacted_thinking") {
    const redacted = native.type === "redacted_thinking";
    return {
      index,
      kind: "reasoning",
      block: {
        type: "reasoning",
        text: redacted ? "[Reasoning redacted]" : asString(native.thinking),
      },
      native: { ...native },
      signature: asString(native.signature),
    };
  }
  if (native.type === "tool_use") {
    return {
      index,
      kind: "tool",
      block: {
        type: "tool-call",
        id: asString(native.id),
        name: asString(native.name),
        input: native.input ?? {},
      },
      native: { ...native },
      json: "",
    };
  }
  return {
    index,
    kind: "native",
    block: { type: "provider-content", provider, data: native },
    native,
    json: native.type === "server_tool_use" ? "" : undefined,
  };
}

function anthropicStop(native: string): StopReason {
  if (native === "max_tokens") return "length";
  if (native === "tool_use") return "tool-use";
  if (native === "refusal") return "refusal";
  if (native === "pause_turn") return "pause";
  if (native === "model_context_window_exceeded") return "context-limit";
  return "stop";
}

function mergeUsage(target: Usage, native: Json): void {
  const uncached = asFiniteNumber(native.input_tokens);
  const cacheRead = asFiniteNumber(native.cache_read_input_tokens);
  const cacheWrite = asFiniteNumber(native.cache_creation_input_tokens);
  if (uncached !== undefined || cacheRead !== undefined || cacheWrite !== undefined) {
    target.input = (uncached ?? 0) + (cacheRead ?? 0) + (cacheWrite ?? 0);
  }
  if (asFiniteNumber(native.output_tokens) !== undefined) {
    target.output = asFiniteNumber(native.output_tokens);
  }
  if (cacheRead !== undefined) target.cacheRead = cacheRead;
  if (cacheWrite !== undefined) target.cacheWrite = cacheWrite;
  if (target.input !== undefined || target.output !== undefined) {
    target.total = (target.input ?? 0) + (target.output ?? 0);
  }
  target.provider = { ...(target.provider ?? {}), ...native };
}
