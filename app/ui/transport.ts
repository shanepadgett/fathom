import type { AppEvent } from "../sdk/session.ts";

import { MAX_RPC_REQUEST_BYTES } from "../sdk/transport.ts";

export class Transport {
  private socket?: WebSocket;
  private opening?: Promise<void>;
  private bootstrap?: AbortController;
  private pending = new Map<
    string,
    {
      resolve(value: unknown): void;
      reject(error: Error): void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private listeners = new Set<(event: AppEvent) => void>();
  private stopped = false;
  private reconnect?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  projectId = "";

  connect(): Promise<void> {
    if (this.stopped) return Promise.reject(new Error("Transport is closed"));
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.opening) return this.opening;
    clearTimeout(this.reconnect);
    this.opening = this.establish()
      .catch((error) => {
        this.scheduleReconnect();
        throw error;
      })
      .finally(() => {
        this.opening = undefined;
      });
    return this.opening;
  }

  private scheduleReconnect() {
    clearTimeout(this.reconnect);
    if (!this.stopped) {
      this.reconnect = setTimeout(() => {
        void this.connect().catch(() => {});
      }, 1500);
    }
  }

  private async establish() {
    this.bootstrap = new AbortController();
    const response = await fetch("/bootstrap", {
      method: "POST",
      signal: AbortSignal.any([this.bootstrap.signal, AbortSignal.timeout(15_000)]),
    });
    if (!response.ok) {
      throw new Error(`Cannot initialize connection (${response.status})`);
    }
    if (this.stopped) throw new Error("Transport is closed");
    const socket = new WebSocket(`${location.origin.replace("http", "ws")}/ws`);
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timed out"));
        socket.close();
      }, 15_000);
      socket.onopen = () => {
        clearTimeout(timeout);
        if (this.stopped || this.socket !== socket) {
          socket.close();
          reject(new Error("Connection superseded"));
          return;
        }
        resolve();
        this.emit({ type: "connected" });
      };
      socket.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Cannot connect to Fathom"));
        socket.close();
      };
      socket.onmessage = (event) => {
        if (this.socket !== socket || this.stopped) return;
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          socket.close(1002, "Invalid response");
          return;
        }
        if (!message || typeof message !== "object") {
          socket.close(1002, "Invalid response");
          return;
        }
        if (message.event && typeof message.event.type === "string") {
          this.emit(message.event);
        } else if (typeof message.id === "string") {
          const pending = this.pending.get(message.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pending.delete(message.id);
          if (message.error) pending.reject(new Error(String(message.error)));
          else pending.resolve(message.result);
        }
      };
      socket.onclose = () => {
        clearTimeout(timeout);
        reject(new Error("Connection closed before opening"));
        if (this.socket !== socket) return;
        this.socket = undefined;
        clearInterval(this.heartbeat);
        this.rejectPending(
          "Connection lost. Reconnect to inspect the saved state before retrying.",
        );
        if (!this.stopped) {
          this.emit({ type: "disconnected" });
          this.scheduleReconnect();
        }
      };
    });
    if (this.stopped || this.socket !== socket) return;
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      void this.request("ping", {}, 10_000).catch(() => {
        if (this.socket === socket) socket.close();
      });
    }, 20_000);
  }

  request<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 120_000,
  ): Promise<T> {
    const socket = this.socket;
    if (this.stopped || socket?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Reconnecting to Fathom…"));
    }
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Request timed out; inspect current state before retrying"));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      try {
        const message = JSON.stringify({
          id,
          method,
          params: { projectId: this.projectId, ...params },
        });
        if (new TextEncoder().encode(message).byteLength > MAX_RPC_REQUEST_BYTES) {
          throw new Error("Request exceeds the 25 MB transport limit");
        }
        socket.send(message);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  private rejectPending(message: string) {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(message));
    }
    this.pending.clear();
  }

  onEvent(listener: (event: AppEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(event: AppEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Transport event listener failed", error);
      }
    }
  }
  dispose() {
    this.stopped = true;
    this.bootstrap?.abort();
    clearTimeout(this.reconnect);
    clearInterval(this.heartbeat);
    this.rejectPending("Transport is closed");
    this.socket?.close();
    this.listeners.clear();
  }
}
