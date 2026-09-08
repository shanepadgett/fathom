import type { ModelMessage } from "../contracts/model.ts";
import type {
  DisplayMessage,
  HarnessEvent,
  RunStatus,
  SessionService,
} from "../contracts/session.ts";

import { Storage } from "../integration/storage.ts";
import { definePlugin } from "../kernel/plugin.ts";
export class MemorySession implements SessionService {
  private id: string = crypto.randomUUID();
  private state: RunStatus = "idle";
  private messages: DisplayMessage[] = [];
  private listeners = new Set<(event: HarnessEvent) => void>();
  history: ModelMessage[] = [];
  constructor(private storage?: Storage) {
    const saved = storage?.load();
    if (saved) {
      this.id = saved.snapshot.id;
      this.messages = saved.snapshot.messages;
      this.history = saved.history;
      this.state = saved.snapshot.status === "running" ? "cancelled" : saved.snapshot.status;
      if (saved.snapshot.status === "running") {
        this.messages.push({
          id: crypto.randomUUID(),
          role: "system",
          text: "Previous run was interrupted. No tools were replayed.",
        });
      }
    }
  }
  snapshot() {
    return structuredClone({
      id: this.id,
      status: this.state,
      messages: this.messages,
      events: [],
    });
  }
  append(message: Omit<DisplayMessage, "id">) {
    this.messages.push({ ...message, id: crypto.randomUUID() });
    this.publish({ type: "snapshot", session: this.snapshot() });
  }
  status(status: RunStatus) {
    this.state = status;
    this.publish({ type: "status", status });
  }
  reset() {
    this.id = crypto.randomUUID();
    this.messages = [];
    this.history = [];
    this.state = "idle";
    this.publish({ type: "snapshot", session: this.snapshot() });
  }
  publish(event: HarnessEvent) {
    if (event.type !== "delta") {
      this.storage?.save(this.snapshot(), this.history);
    }
    for (const listener of this.listeners) listener(event);
  }
  subscribe(listener: (event: HarnessEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  dispose() {
    this.storage?.save(this.snapshot(), this.history);
    this.storage?.close();
    this.listeners.clear();
  }
}
export default definePlugin({
  id: "session-memory",
  apiVersion: 1,
  provides: ["sessions"],
  requires: ["workspace"],
  async activate(ctx) {
    const storage = new Storage(ctx.get("workspace").root);
    const { migrate } = await import("drizzle-orm/node-sqlite/migrator");
    try {
      migrate(storage.db, {
        migrationsFolder: new URL("../../migrations", import.meta.url).pathname,
      });
    } catch (error) {
      storage.close();
      throw error;
    }
    const session = new MemorySession(storage);
    ctx.provide("sessions", session);
    ctx.effect(() => () => session.dispose());
  },
});
