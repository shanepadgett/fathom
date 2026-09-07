import { definePlugin } from "../kernel/plugin.ts";
import type {
  DisplayMessage,
  HarnessEvent,
  RunStatus,
  SessionService,
} from "../contracts/session.ts";
import type { ModelMessage } from "../contracts/model.ts";
export class MemorySession implements SessionService {
  private id = crypto.randomUUID();
  private state: RunStatus = "idle";
  private messages: DisplayMessage[] = [];
  private listeners = new Set<(event: HarnessEvent) => void>();
  history: ModelMessage[] = [];
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
    for (const listener of this.listeners) listener(event);
  }
  subscribe(listener: (event: HarnessEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  dispose() {
    this.listeners.clear();
  }
}
export default definePlugin({
  id: "session-memory",
  apiVersion: 1,
  provides: ["sessions"],
  activate(ctx) {
    const session = new MemorySession();
    ctx.provide("sessions", session);
    ctx.effect(() => () => session.dispose());
  },
});
