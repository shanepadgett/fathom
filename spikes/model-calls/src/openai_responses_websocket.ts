import { isJsonObject } from "./json.ts";
import { JsonObject, ModelError } from "./types.ts";
import { JsonWebSocket } from "./websocket.ts";

type Json = JsonObject;
type Connect = (headers?: HeadersInit, signal?: AbortSignal) => Promise<JsonWebSocket>;

interface Continuation {
  body: Json;
  responseId: string;
  output: unknown[];
}

export class OpenAIResponsesWebSocket {
  readonly #connect: Connect;
  #socket?: JsonWebSocket;
  #continuation?: Continuation;
  #active = false;

  constructor(connect: Connect) {
    this.#connect = connect;
  }

  async *events(
    body: Json,
    signal?: AbortSignal,
    headers?: HeadersInit,
  ): AsyncGenerator<Json> {
    if (this.#active) {
      throw new ModelError("invalid-request", "WebSocket model is already streaming");
    }
    this.#active = true;

    try {
      const delta = this.#continuation && inputDelta(body, this.#continuation);
      let request = delta
        ? { ...body, input: delta, previous_response_id: this.#continuation!.responseId }
        : body;
      let retried = false;

      while (true) {
        const output: unknown[] = [];
        let completed = false;
        let retry = false;
        try {
          const socket = this.#socket ??= await this.#connect(headers, signal);
          for await (
            const event of socket.request(
              { type: "response.create", ...request },
              isTerminal,
              signal,
            )
          ) {
            if (isPreviousResponseMissing(event) && "previous_response_id" in request && !retried) {
              retried = true;
              retry = true;
              break;
            }
            if (event.type === "response.output_item.done" && isJsonObject(event.item)) {
              output.push(event.item);
            }
            if (isSuccessfulTerminal(event)) {
              const response = isJsonObject(event.response) ? event.response : {};
              const responseId = typeof response.id === "string" ? response.id : "";
              const responseOutput = output.length
                ? output
                : Array.isArray(response.output)
                ? response.output
                : [];
              this.#continuation = responseId
                ? { body, responseId, output: responseOutput }
                : undefined;
              completed = true;
            }
            yield event;
          }
          if (completed) return;
          if (retry) {
            request = body;
            continue;
          }
          throw new Error("WebSocket response ended without a terminal event");
        } catch (error) {
          this.#continuation = undefined;
          this.#drop();
          throw error;
        } finally {
          if (!completed) {
            this.#continuation = undefined;
            this.#drop();
          }
        }
      }
    } finally {
      this.#active = false;
    }
  }

  close(): void {
    this.#continuation = undefined;
    this.#drop();
  }

  #drop(): void {
    this.#socket?.close();
    this.#socket = undefined;
  }
}

function inputDelta(body: Json, continuation: Continuation): unknown[] | undefined {
  if (JSON.stringify(withoutInput(body)) !== JSON.stringify(withoutInput(continuation.body))) {
    return undefined;
  }
  const input = Array.isArray(body.input) ? body.input : [];
  const previous = Array.isArray(continuation.body.input) ? continuation.body.input : [];
  const prefix = [...previous, ...continuation.output];
  if (input.length < prefix.length) return undefined;
  if (JSON.stringify(input.slice(0, prefix.length)) !== JSON.stringify(prefix)) return undefined;
  return input.slice(prefix.length);
}

function withoutInput(body: Json): Json {
  const { input: _input, previous_response_id: _previous, ...rest } = body;
  return rest;
}

function isTerminal(event: Json): boolean {
  return event.type === "response.completed" || event.type === "response.done" ||
    event.type === "response.incomplete" || event.type === "response.failed" ||
    event.type === "error";
}

function isSuccessfulTerminal(event: Json): boolean {
  return event.type === "response.completed" || event.type === "response.done" ||
    event.type === "response.incomplete";
}

function isPreviousResponseMissing(event: Json): boolean {
  const error = isJsonObject(event.error) ? event.error : {};
  const response = isJsonObject(event.response) ? event.response : {};
  const responseError = isJsonObject(response.error) ? response.error : {};
  return (event.type === "error" || event.type === "response.failed") &&
    (event.code === "previous_response_not_found" || error.code === "previous_response_not_found" ||
      responseError.code === "previous_response_not_found");
}
