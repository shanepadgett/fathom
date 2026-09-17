import type { BrowserEvent } from "./connection.ts";

interface Pending {
  resolve(value: Record<string, unknown>): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

/** CDP request and navigation semantics, independent of socket/native transport. */
export class BrowserProtocol {
  private pending = new Map<number, Pending>();
  private listeners = new Set<BrowserEvent>();
  private disconnected = new Set<() => void>();
  private sequence = 0;
  private failure?: Error;

  constructor(
    private send: (message: string) => void,
    private event: BrowserEvent,
  ) {}

  get closed() {
    return this.failure !== undefined;
  }

  receive(data: string) {
    if (this.failure) return;
    const message = JSON.parse(data);
    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(String(message.error.message)));
      } else pending.resolve(message.result ?? {});
    } else if (typeof message.method === "string") {
      const params = message.params ?? {};
      for (const listener of this.listeners) listener(message.method, params);
      this.event(message.method, params);
    }
  }

  call(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    if (this.failure) return Promise.reject(this.failure);
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Browser operation timed out: ${method}`));
      }, 15_000);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async navigate(url: string) {
    const stopped = new Set<string>();
    let frameId: string | undefined;
    let loaded!: () => void;
    const ready = new Promise<void>((resolve) => {
      loaded = resolve;
    });
    const listener: BrowserEvent = (name, params) => {
      if (name !== "Page.frameStoppedLoading") return;
      stopped.add(String(params.frameId));
      if (params.frameId === frameId) loaded();
    };
    this.listeners.add(listener);
    this.disconnected.add(loaded);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await this.call("Page.navigate", { url });
      if (this.failure) throw this.failure;
      if (result.errorText) {
        throw new Error(`Navigation failed: ${result.errorText}`);
      }
      frameId = String(result.frameId);
      if (!result.loaderId || stopped.has(frameId)) return;
      await Promise.race([
        ready,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Page did not finish loading within 15 seconds")),
            15_000,
          );
        }),
      ]);
      if (this.failure) throw this.failure;
    } finally {
      clearTimeout(timer);
      this.listeners.delete(listener);
      this.disconnected.delete(loaded);
    }
  }

  close(error = new Error("Browser closed")) {
    if (this.failure) return;
    this.failure = error;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    for (const notify of this.disconnected) notify();
    this.disconnected.clear();
    this.listeners.clear();
  }
}
