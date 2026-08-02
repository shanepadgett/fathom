import { isJsonObject } from "./json.ts";
import { JsonObject, ModelError } from "./types.ts";

type Json = JsonObject;

export class JsonWebSocket {
  readonly #url: string;
  readonly #headers: HeadersInit;
  #socket?: WebSocketStream;
  #connection?: WebSocketConnection;
  #busy = false;

  constructor(url: string, headers: HeadersInit) {
    this.#url = url;
    this.#headers = headers;
  }

  async *request(
    message: unknown,
    terminal: (event: Json) => boolean,
    signal?: AbortSignal,
  ): AsyncGenerator<Json> {
    if (this.#busy) throw new ModelError("invalid-request", "WebSocket model is already streaming");
    this.#busy = true;
    let complete = false;

    try {
      const connection = await this.#connect(signal);
      const writer = connection.writable.getWriter();
      try {
        await writer.write(JSON.stringify(message));
      } finally {
        writer.releaseLock();
      }

      const reader = connection.readable.getReader();
      const abort = () => this.close(1000, "aborted");
      signal?.addEventListener("abort", abort, { once: true });
      try {
        while (true) {
          if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
          const chunk = await reader.read();
          if (chunk.done) throw new Error("WebSocket closed before a terminal response event");
          const text = typeof chunk.value === "string"
            ? chunk.value
            : new TextDecoder().decode(chunk.value);
          let event: unknown;
          try {
            event = JSON.parse(text);
          } catch (error) {
            throw new ModelError("protocol", "WebSocket contained invalid JSON", { cause: error });
          }
          if (!isJsonObject(event)) {
            throw new ModelError("protocol", "WebSocket event was not an object");
          }
          complete = terminal(event);
          yield event;
          if (complete) return;
        }
      } finally {
        signal?.removeEventListener("abort", abort);
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof ModelError) throw error;
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        throw new ModelError("aborted", "WebSocket model request was aborted", { cause: error });
      }
      throw new ModelError("network", "WebSocket model request failed", { cause: error });
    } finally {
      this.#busy = false;
      if (!complete) this.close();
    }
  }

  close(code = 1000, reason = "done"): void {
    const socket = this.#socket;
    this.#socket = undefined;
    this.#connection = undefined;
    if (!socket) return;
    try {
      socket.close({ code, reason });
    } catch {
      // Already closed.
    }
  }

  async #connect(signal?: AbortSignal): Promise<WebSocketConnection> {
    if (this.#connection) return this.#connection;
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    const socket = new WebSocketStream(this.#url, { headers: this.#headers, signal });
    this.#socket = socket;
    void socket.closed.catch(() => {});
    try {
      return this.#connection = await socket.opened;
    } catch (error) {
      this.close();
      throw error;
    }
  }
}
