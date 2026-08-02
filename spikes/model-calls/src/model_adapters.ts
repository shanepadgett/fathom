import { buildAnthropicMessagesBody, parseAnthropicMessagesStream } from "./anthropic_messages.ts";
import {
  buildOpenAIResponsesBody,
  OpenAIResponsesRoute,
  parseOpenAIResponsesEvents,
  parseOpenAIResponsesStream,
} from "./openai_responses.ts";
import { OpenAIResponsesWebSocket } from "./openai_responses_websocket.ts";
import { resolveGrammarTools } from "./constrained_sampling.ts";
import {
  AnthropicMessagesOptions,
  OpenAICodexOptions,
  XaiResponsesOptions,
} from "./provider_options.ts";
import { postSse } from "./transport.ts";
import { Authorizer, Fetch, Model, ModelSession, ModelToolCapabilities } from "./types.ts";
import { JsonWebSocket } from "./websocket.ts";

export interface ModelAdapterOptions {
  id: string;
  auth: Authorizer;
  fetch?: Fetch;
  toolCapabilities: ModelToolCapabilities;
}

export interface AnthropicModelAdapterOptions extends ModelAdapterOptions {
  requiredSystemPrompt?: string;
}

const OPENAI_CODEX_RESPONSES = "openai-codex-responses";
const ANTHROPIC_MESSAGES = "anthropic-messages";
const XAI_RESPONSES = "xai-responses";
export function openAICodexModel(options: ModelAdapterOptions): Model<OpenAICodexOptions> {
  const fetch = options.fetch ?? globalThis.fetch;
  const toolSupport = options.toolCapabilities;
  const route = codexRoute(options.id, toolSupport);
  const model: Model<OpenAICodexOptions> = {
    id: options.id,
    provider: OPENAI_CODEX_RESPONSES,
    capabilities: toolSupport,
    createSession(): ModelSession<OpenAICodexOptions> {
      return {
        async *stream(request) {
          const body = buildOpenAIResponsesBody(request, route);
          const auth = await options.auth.requestAuth(request.signal);
          const headers = providerHeaders(
            auth.headers,
            request.providerOptions?.additionalHeaders,
            { "OpenAI-Beta": "responses=experimental" },
          );
          const stream = await postSse(
            fetch,
            "https://chatgpt.com/backend-api/codex/responses",
            headers,
            body,
            request.signal,
          );
          yield* parseOpenAIResponsesStream(
            stream,
            OPENAI_CODEX_RESPONSES,
            options.id,
            request.signal,
            resolveGrammarTools(request.tools, toolSupport),
          );
        },
        close() {},
      };
    },
  };
  return model;
}

export function openAICodexWebSocketModel(
  options: ModelAdapterOptions,
): Model<OpenAICodexOptions> {
  const toolSupport = options.toolCapabilities;
  const route = codexRoute(options.id, toolSupport);
  const model: Model<OpenAICodexOptions> = {
    id: options.id,
    provider: OPENAI_CODEX_RESPONSES,
    capabilities: toolSupport,
    createSession(): ModelSession<OpenAICodexOptions> {
      const transport = new OpenAIResponsesWebSocket(async (additionalHeaders, signal) => {
        const auth = await options.auth.requestAuth(signal);
        const requestId = crypto.randomUUID();
        const headers = providerHeaders(auth.headers, additionalHeaders, {
          "OpenAI-Beta": "responses=experimental",
          "session-id": requestId,
          "x-client-request-id": requestId,
        });
        return new JsonWebSocket("wss://chatgpt.com/backend-api/codex/responses", headers);
      });
      return {
        async *stream(request) {
          const body = buildOpenAIResponsesBody(request, route);
          delete body.stream;
          yield* parseOpenAIResponsesEvents(
            transport.events(body, request.signal, request.providerOptions?.additionalHeaders),
            OPENAI_CODEX_RESPONSES,
            options.id,
            request.signal,
            resolveGrammarTools(request.tools, toolSupport),
          );
        },
        close: () => transport.close(),
      };
    },
  };
  return model;
}

export function anthropicModel(
  options: AnthropicModelAdapterOptions,
): Model<AnthropicMessagesOptions> {
  const fetch = options.fetch ?? globalThis.fetch;
  const toolSupport = options.toolCapabilities;
  const model: Model<AnthropicMessagesOptions> = {
    id: options.id,
    provider: ANTHROPIC_MESSAGES,
    capabilities: toolSupport,
    createSession(): ModelSession<AnthropicMessagesOptions> {
      return {
        async *stream(request) {
          const body = buildAnthropicMessagesBody(
            request,
            ANTHROPIC_MESSAGES,
            options.id,
            options.requiredSystemPrompt,
            toolSupport,
          );
          const auth = await options.auth.requestAuth(request.signal);
          const requestedBetas = request.providerOptions?.betas?.join(",");
          const requiredBetas = new Headers(auth.headers).get("anthropic-beta");
          const beta = [requiredBetas, requestedBetas].filter(Boolean).join(",");
          const headers = providerHeaders(
            auth.headers,
            request.providerOptions?.additionalHeaders,
            beta ? { "anthropic-beta": beta } : undefined,
          );
          const stream = await postSse(
            fetch,
            "https://api.anthropic.com/v1/messages",
            headers,
            body,
            request.signal,
          );
          yield* parseAnthropicMessagesStream(
            stream,
            ANTHROPIC_MESSAGES,
            options.id,
            request.signal,
          );
        },
        close() {},
      };
    },
  };
  return model;
}

export function xaiModel(options: ModelAdapterOptions): Model<XaiResponsesOptions> {
  const fetch = options.fetch ?? globalThis.fetch;
  const toolSupport = options.toolCapabilities;
  const route: OpenAIResponsesRoute = {
    provider: XAI_RESPONSES,
    model: options.id,
    systemPrompt: "developer-message",
    toolCapabilities: toolSupport,
    maxOutputTokens: true,
    conversation: true,
    cacheRetention: true,
    storedResponses: true,
  };
  const model: Model<XaiResponsesOptions> = {
    id: options.id,
    provider: XAI_RESPONSES,
    capabilities: toolSupport,
    createSession(): ModelSession<XaiResponsesOptions> {
      return {
        async *stream(request) {
          const body = buildOpenAIResponsesBody(request, route);
          const auth = await options.auth.requestAuth(request.signal);
          const headers = providerHeaders(
            auth.headers,
            request.providerOptions?.additionalHeaders,
          );
          const stream = await postSse(
            fetch,
            "https://api.x.ai/v1/responses",
            headers,
            body,
            request.signal,
          );
          yield* parseOpenAIResponsesStream(
            stream,
            XAI_RESPONSES,
            options.id,
            request.signal,
            resolveGrammarTools(request.tools, toolSupport),
          );
        },
        close() {},
      };
    },
  };
  return model;
}

function codexRoute(
  model: string,
  toolCapabilities: ModelToolCapabilities,
): OpenAIResponsesRoute {
  return {
    provider: OPENAI_CODEX_RESPONSES,
    model,
    systemPrompt: "instructions",
    toolCapabilities,
    maxOutputTokens: false,
    conversation: false,
    cacheRetention: false,
    storedResponses: false,
  };
}

const FORBIDDEN_ADDITIONAL_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "cookie",
  "host",
  "x-api-key",
];

function providerHeaders(
  auth: HeadersInit,
  additional?: HeadersInit,
  route?: HeadersInit,
): Headers {
  const headers = new Headers(additional);
  for (const name of FORBIDDEN_ADDITIONAL_HEADERS) headers.delete(name);
  new Headers(auth).forEach((value, name) => headers.set(name, value));
  new Headers(route).forEach((value, name) => headers.set(name, value));
  headers.set("accept", "text/event-stream");
  headers.set("content-type", "application/json");
  return headers;
}
