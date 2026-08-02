import { compatibleContinuation } from "./continuation.ts";
import { GrammarTool, resolveGrammarTools, resolveStrictSampling } from "./constrained_sampling.ts";
import { asFiniteNumber, asJsonObject, asString, isJsonObject, omitUndefined } from "./json.ts";
import { OpenAIResponsesOptions } from "./provider_options.ts";
import { parseSse } from "./sse.ts";
import {
  AssistantContent,
  AssistantMessage,
  Completion,
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

export interface OpenAIResponsesRoute {
  provider: string;
  model: string;
  systemPrompt: "instructions" | "developer-message";
  toolCapabilities: ModelToolCapabilities;
  maxOutputTokens: boolean;
  conversation: boolean;
  cacheRetention: boolean;
  storedResponses: boolean;
}

export function buildOpenAIResponsesInput(
  request: ModelRequest<OpenAIResponsesOptions>,
  provider: string,
  model: string,
  grammars: ReadonlyMap<string, GrammarTool> = new Map(),
): unknown[] {
  const input: unknown[] = [];
  for (const message of request.transcript) {
    if (message.role === "user") {
      input.push({
        role: "user",
        content: message.content.map((block) => openAIInputContent(block, provider)),
      });
      continue;
    }
    if (message.role === "tool") {
      const grammar = grammars.get(message.name);
      input.push({
        type: grammar ? "custom_tool_call_output" : "function_call_output",
        call_id: message.callId,
        output: openAIToolOutput(message.content, provider),
      });
      continue;
    }

    const replay = compatibleContinuation(message.continuation, provider, model);
    if (Array.isArray(replay)) {
      input.push(...replay);
      continue;
    }

    const messageContent: unknown[] = [];
    for (const block of message.content) {
      if (block.type === "text") {
        messageContent.push({
          type: "output_text",
          text: block.text,
          annotations: block.annotations?.map((annotation) => annotation.data) ?? [],
        });
      } else if (block.type === "refusal") {
        messageContent.push({ type: "refusal", refusal: block.text });
      } else if (block.type === "tool-call") {
        const grammar = grammars.get(block.name);
        input.push(
          grammar
            ? {
              type: "custom_tool_call",
              call_id: block.id,
              name: block.name,
              input: grammarInput(block.input, grammar, block.name),
            }
            : {
              type: "function_call",
              call_id: block.id,
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
        );
      } else if (block.type === "provider-content" && block.provider === provider) {
        input.push(block.data);
      }
    }
    if (messageContent.length) {
      input.push({
        type: "message",
        role: "assistant",
        status: "completed",
        content: messageContent,
      });
    }
  }
  return input;
}

export function buildOpenAIResponsesBody(
  request: ModelRequest<OpenAIResponsesOptions>,
  route: OpenAIResponsesRoute,
): Json {
  const options = request.providerOptions ?? {};
  const grammars = resolveGrammarTools(request.tools, route.toolCapabilities);
  const input = buildOpenAIResponsesInput(request, route.provider, route.model, grammars);
  if (route.systemPrompt === "developer-message" && request.system) {
    input.unshift({ role: "developer", content: request.system });
  }

  const body: Json = {
    ...options.additionalBody,
    model: route.model,
    input,
    stream: true,
    store: route.storedResponses ? options.store ?? false : false,
    include: options.include ?? ["reasoning.encrypted_content"],
    parallel_tool_calls: options.parallel_tool_calls ?? true,
    tool_choice: openAIToolChoice(request.toolChoice, grammars),
  };
  if (route.systemPrompt === "instructions") body.instructions = request.system;
  if (route.maxOutputTokens && request.maxOutputTokens !== undefined) {
    body.max_output_tokens = request.maxOutputTokens;
  }
  body.reasoning = options.reasoning ??
    (request.reasoning ? { effort: request.reasoning, summary: "auto" } : undefined);
  body.text = options.text ??
    (request.responseFormat ? openAITextFormat(request.responseFormat) : undefined);

  for (
    const key of [
      "context_management",
      "conversation",
      "max_tool_calls",
      "prompt",
      "service_tier",
      "temperature",
      "top_p",
      "truncation",
      "prompt_cache_retention",
      "prompt_cache_options",
      "previous_response_id",
      "safety_identifier",
      "stream_options",
      "top_logprobs",
      "user",
      "metadata",
    ] as const
  ) {
    if (options[key] !== undefined) body[key] = options[key];
  }
  if (request.cache) {
    if (request.cache.retention === "none") {
      delete body.prompt_cache_key;
      delete body.prompt_cache_retention;
      if (route.cacheRetention) body.prompt_cache_options = { mode: "explicit" };
    } else {
      body.prompt_cache_key = clampCacheKey(request.cache.key);
      if (route.cacheRetention) {
        body.prompt_cache_retention = request.cache.retention === "long" ? "24h" : "in_memory";
      }
    }
  }

  const tools = [
    ...(request.tools ?? []).map((tool) => {
      const grammar = grammars.get(tool.name);
      return grammar
        ? {
          ...tool.providerData?.[route.provider],
          type: "custom",
          name: tool.name,
          description: tool.description,
          format: {
            type: "grammar",
            syntax: grammar.format,
            definition: grammar.definition,
          },
        }
        : {
          ...tool.providerData?.[route.provider],
          type: "function",
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          strict: resolveStrictSampling(tool, route.toolCapabilities),
        };
    }),
    ...(request.nativeTools ?? [])
      .filter((tool) => tool.provider === route.provider)
      .map((tool) => tool.definition),
  ];
  if (tools.length) body.tools = tools;
  else delete body.tools;
  if (!route.maxOutputTokens) delete body.max_output_tokens;
  if (!route.conversation) {
    delete body.conversation;
    delete body.previous_response_id;
  }
  if (!route.cacheRetention) {
    delete body.prompt_cache_retention;
    delete body.prompt_cache_options;
  }
  delete body.background;
  return omitUndefined(body);
}

type Entry = {
  index: number;
  outputIndex: number;
  contentIndex?: number;
  kind: "text" | "reasoning" | "refusal" | "tool" | "native";
  block?: AssistantContent;
  id?: string;
  name?: string;
  json?: string;
  grammar?: GrammarTool;
  grammarClosed?: boolean;
};

export async function* parseOpenAIResponsesStream(
  body: ReadableStream<Uint8Array>,
  provider: string,
  model: string,
  signal?: AbortSignal,
  grammars: ReadonlyMap<string, GrammarTool> = new Map(),
): AsyncGenerator<ModelEvent> {
  async function* frames(): AsyncGenerator<unknown> {
    for await (const frame of parseSse(body, signal)) yield frame.data;
  }
  yield* parseOpenAIResponsesEvents(frames(), provider, model, signal, grammars);
}

export async function* parseOpenAIResponsesEvents(
  events: AsyncIterable<unknown>,
  provider: string,
  model: string,
  signal?: AbortSignal,
  grammars: ReadonlyMap<string, GrammarTool> = new Map(),
): AsyncGenerator<ModelEvent> {
  const entries: Entry[] = [];
  const slots = new Map<string, Entry>();
  const nativeOutput = new Map<number, Json>();
  let observed = false;

  const partial = (continuation?: unknown): AssistantMessage => ({
    role: "assistant",
    content: entries.flatMap((entry) => entry.block ? [entry.block] : []),
    ...(continuation === undefined
      ? {}
      : { continuation: { provider, model, value: continuation } }),
  });
  const fail = (message: string, cause?: unknown): ModelError =>
    new ModelError("protocol", message, { outputObserved: observed, partial: partial(), cause });
  const add = (
    key: string,
    outputIndex: number,
    kind: Entry["kind"],
    block?: AssistantContent,
    contentIndex?: number,
  ): Entry => {
    const old = slots.get(key);
    if (old) return old;
    const entry = { index: entries.length, outputIndex, contentIndex, kind, block };
    entries.push(entry);
    slots.set(key, entry);
    return entry;
  };

  try {
    for await (const frame of events) {
      if (frame === "[DONE]") continue;
      let event: Json;
      try {
        const parsed = typeof frame === "string" ? JSON.parse(frame) as unknown : frame;
        if (!isJsonObject(parsed)) throw new Error("event is not an object");
        event = parsed;
      } catch (error) {
        throw fail("Responses stream contained invalid JSON", error);
      }

      yield { type: "provider-event", provider, event };
      const type = asString(event.type);
      const outputIndex = asFiniteNumber(event.output_index) ?? 0;
      const contentIndex = asFiniteNumber(event.content_index) ?? 0;
      const item = asJsonObject(event.item);
      const itemKey = `o:${outputIndex}`;
      const contentKey = `o:${outputIndex}:c:${contentIndex}`;

      if (type === "response.output_item.added") {
        if (item.type === "function_call") {
          const entry = add(itemKey, outputIndex, "tool");
          entry.id = asString(item.call_id);
          entry.name = asString(item.name);
          entry.json = asString(item.arguments);
        } else if (item.type === "custom_tool_call") {
          const grammar = grammars.get(asString(item.name));
          if (grammar) {
            const entry = add(itemKey, outputIndex, "tool");
            entry.id = asString(item.call_id);
            entry.name = asString(item.name);
            entry.json = "";
            entry.grammar = grammar;
          }
        } else if (item.type === "reasoning") {
          add(itemKey, outputIndex, "reasoning", { type: "reasoning", text: "" });
        }
      } else if (type === "response.content_part.added") {
        const part = asJsonObject(event.part);
        if (part.type === "output_text") {
          add(contentKey, outputIndex, "text", { type: "text", text: "" }, contentIndex);
        } else if (part.type === "refusal") {
          add(contentKey, outputIndex, "refusal", { type: "refusal", text: "" }, contentIndex);
        }
      } else if (type === "response.output_text.delta") {
        const entry = add(
          contentKey,
          outputIndex,
          "text",
          { type: "text", text: "" },
          contentIndex,
        );
        const delta = asString(event.delta);
        if (entry.block?.type === "text") entry.block.text += delta;
        observed ||= delta.length > 0;
        yield { type: "text-delta", index: entry.index, text: delta };
      } else if (type === "response.refusal.delta") {
        const entry = add(
          contentKey,
          outputIndex,
          "refusal",
          { type: "refusal", text: "" },
          contentIndex,
        );
        const delta = asString(event.delta);
        if (entry.block?.type === "refusal") entry.block.text += delta;
        observed ||= delta.length > 0;
      } else if (
        type === "response.reasoning_summary_text.delta" || type === "response.reasoning_text.delta"
      ) {
        const entry = add(itemKey, outputIndex, "reasoning", { type: "reasoning", text: "" });
        const delta = asString(event.delta);
        if (entry.block?.type === "reasoning") entry.block.text += delta;
        observed ||= delta.length > 0;
        yield { type: "reasoning-delta", index: entry.index, text: delta };
      } else if (type === "response.function_call_arguments.delta") {
        const entry = add(itemKey, outputIndex, "tool");
        entry.json = (entry.json ?? "") + asString(event.delta);
        observed ||= asString(event.delta).length > 0;
      } else if (type === "response.function_call_arguments.done") {
        const entry = add(itemKey, outputIndex, "tool");
        if (typeof event.arguments === "string") entry.json = event.arguments;
      } else if (type === "response.custom_tool_call_input.delta") {
        const entry = slots.get(itemKey);
        if (!entry?.grammar) continue;
        appendGrammarInput(entry, (entry.json ?? "") + asString(event.delta), false);
        observed ||= asString(event.delta).length > 0;
      } else if (type === "response.custom_tool_call_input.done") {
        const entry = slots.get(itemKey);
        if (!entry?.grammar) continue;
        appendGrammarInput(entry, asString(event.input), true);
      } else if (type === "response.output_item.done") {
        nativeOutput.set(outputIndex, item);
        let entry = slots.get(itemKey);
        if (item.type === "function_call" || (item.type === "custom_tool_call" && entry?.grammar)) {
          entry ??= add(itemKey, outputIndex, "tool");
          let input: unknown;
          if (entry.grammar) {
            appendGrammarInput(entry, asString(item.input) || entry.json || "", true);
            input = { [entry.grammar.inputProperty]: entry.json ?? "" };
          } else {
            const raw = asString(item.arguments) || entry.json || "{}";
            try {
              input = JSON.parse(raw);
            } catch (error) {
              throw fail("Responses tool call ended with invalid JSON", error);
            }
          }
          const call = {
            type: "tool-call" as const,
            id: asString(item.call_id) || entry.id || "",
            name: asString(item.name) || entry.name || "",
            input,
          };
          entry.block = call;
          observed = true;
          yield { type: "tool-call", index: entry.index, call };
        } else if (item.type === "message") {
          reconcileMessage(entries, slots, outputIndex, item);
        } else if (item.type === "reasoning") {
          entry ??= add(itemKey, outputIndex, "reasoning", { type: "reasoning", text: "" });
          if (entry.block?.type === "reasoning" && !entry.block.text) {
            entry.block.text = reasoningText(item);
          }
        } else {
          add(itemKey, outputIndex, "native", {
            type: "provider-content",
            provider,
            data: item,
          });
        }
      } else if (type === "response.failed" || type === "error") {
        const error = asJsonObject(event.error);
        throw new ModelError("server", asString(error.message) || "Responses route failed", {
          outputObserved: observed,
          partial: partial(),
          providerCode: asString(error.code) || undefined,
        });
      } else if (isTerminal(type)) {
        const response = asJsonObject(event.response);
        const responseOutput = Array.isArray(response.output) ? response.output : [];
        const output = responseOutput.length
          ? responseOutput
          : [...nativeOutput.entries()].sort(([a], [b]) => a - b).map(([, value]) => value);
        const completion: Completion = {
          id: asString(response.id) || undefined,
          message: partial(output),
          stopReason: responsesStop(response, entries),
          usage: responsesUsage(response.usage),
          providerData: response,
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
    throw fail("Responses stream failed", error);
  }
  throw fail("Responses stream ended before a terminal response event");
}

function openAIInputContent(block: InputContent, provider: string): Json {
  const native = block.providerData?.[provider] ?? {};
  if (block.type === "text") return { ...native, type: "input_text", text: block.text };
  if (block.type === "provider-content") {
    return block.provider === provider
      ? block.data
      : { type: "input_text", text: JSON.stringify(block.data) };
  }
  if (block.type === "image") {
    const source = block.source;
    return omitUndefined({
      ...native,
      type: "input_image",
      detail: block.detail,
      image_url: source.type === "url"
        ? source.url
        : source.type === "base64"
        ? `data:${source.mediaType};base64,${source.data}`
        : undefined,
      file_id: source.type === "file" ? source.id : undefined,
    });
  }
  const source = block.source;
  return omitUndefined({
    ...native,
    type: "input_file",
    file_url: source.type === "url" ? source.url : undefined,
    file_data: source.type === "base64"
      ? `data:${source.mediaType};base64,${source.data}`
      : source.type === "text"
      ? `data:text/plain;base64,${encodeBase64(source.text)}`
      : undefined,
    file_id: source.type === "file" ? source.id : undefined,
    filename: "filename" in source ? source.filename : undefined,
  });
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function openAIToolOutput(content: InputContent[], provider: string): string | Json[] {
  if (content.every((block) => block.type === "text")) {
    return content.map((block) => block.type === "text" ? block.text : "").join("");
  }
  return content.map((block) => openAIInputContent(block, provider));
}

function openAIToolChoice(
  value: ModelRequest["toolChoice"],
  grammars: ReadonlyMap<string, GrammarTool>,
): unknown {
  if (!value) return "auto";
  if (typeof value === "string") return value;
  return { type: grammars.has(value.name) ? "custom" : "function", name: value.name };
}

function openAITextFormat(format: NonNullable<ModelRequest["responseFormat"]>): Json {
  return {
    format: omitUndefined({
      type: "json_schema",
      name: format.name,
      schema: format.schema,
      description: format.description,
      strict: format.strict,
    }),
  };
}

function reconcileMessage(
  entries: Entry[],
  slots: Map<string, Entry>,
  outputIndex: number,
  item: Json,
): void {
  const content = Array.isArray(item.content) ? item.content : [];
  for (let contentIndex = 0; contentIndex < content.length; contentIndex++) {
    const native = asJsonObject(content[contentIndex]);
    const key = `o:${outputIndex}:c:${contentIndex}`;
    let entry = slots.get(key);
    if (native.type === "output_text") {
      entry ??= appendEntry(entries, slots, key, outputIndex, contentIndex, "text", {
        type: "text",
        text: "",
      });
      if (entry.block?.type === "text") {
        entry.block.text = asString(native.text);
        entry.block.annotations = Array.isArray(native.annotations)
          ? native.annotations.filter(isJsonObject).map((data) => ({
            type: asString(data.type),
            data,
          }))
          : undefined;
      }
    } else if (native.type === "refusal") {
      entry ??= appendEntry(entries, slots, key, outputIndex, contentIndex, "refusal", {
        type: "refusal",
        text: "",
      });
      if (entry.block?.type === "refusal") entry.block.text = asString(native.refusal);
    }
  }
}

function appendEntry(
  entries: Entry[],
  slots: Map<string, Entry>,
  key: string,
  outputIndex: number,
  contentIndex: number,
  kind: Entry["kind"],
  block: AssistantContent,
): Entry {
  const entry = { index: entries.length, outputIndex, contentIndex, kind, block };
  entries.push(entry);
  slots.set(key, entry);
  return entry;
}

function responsesStop(response: Json, entries: Entry[]): StopReason {
  if (response.status === "incomplete") {
    const reason = asString(asJsonObject(response.incomplete_details).reason);
    return reason.includes("content_filter")
      ? "content-filter"
      : reason.includes("context")
      ? "context-limit"
      : "length";
  }
  if (entries.some((entry) => entry.kind === "tool")) return "tool-use";
  if (entries.some((entry) => entry.kind === "refusal")) return "refusal";
  return "stop";
}

function responsesUsage(value: unknown): Usage | undefined {
  if (!isJsonObject(value)) return undefined;
  const inputDetails = asJsonObject(value.input_tokens_details);
  const outputDetails = asJsonObject(value.output_tokens_details);
  return {
    input: asFiniteNumber(value.input_tokens),
    output: asFiniteNumber(value.output_tokens),
    total: asFiniteNumber(value.total_tokens),
    cacheRead: asFiniteNumber(inputDetails.cached_tokens),
    cacheWrite: asFiniteNumber(inputDetails.cache_write_tokens),
    reasoning: asFiniteNumber(outputDetails.reasoning_tokens),
    provider: value,
  };
}

function reasoningText(item: Json): string {
  const summary = Array.isArray(item.summary) ? item.summary : [];
  const content = Array.isArray(item.content) ? item.content : [];
  return [...summary, ...content].map(asJsonObject).map((part) => asString(part.text)).join("");
}

function grammarInput(input: unknown, grammar: GrammarTool, name: string): string {
  const value = isJsonObject(input) ? input[grammar.inputProperty] : undefined;
  if (typeof value !== "string") {
    throw new ModelError(
      "invalid-request",
      `Grammar tool ${JSON.stringify(name)} requires string input ${
        JSON.stringify(grammar.inputProperty)
      }`,
    );
  }
  return value;
}

function appendGrammarInput(entry: Entry, next: string, close: boolean): void {
  const previous = entry.json ?? "";
  if (entry.grammarClosed) {
    if (close && next === previous) return;
    throw new Error("Custom tool input changed after completion");
  }
  if (!next.startsWith(previous)) throw new Error("Custom tool input changed non-monotonically");
  entry.json = next;
  if (close) entry.grammarClosed = true;
}

function clampCacheKey(value: string | undefined): string | undefined {
  return value === undefined ? undefined : Array.from(value).slice(0, 64).join("");
}

function isTerminal(type: string): boolean {
  return type === "response.completed" || type === "response.done" ||
    type === "response.incomplete";
}
