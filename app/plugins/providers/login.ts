import type { LoginFlow } from "../../sdk/auth.ts";
import type { AuthType, MutableModels } from "@earendil-works/pi-ai";

interface Login extends LoginFlow {
  controller: AbortController;
  answer?: (answer: string) => void;
  timer: ReturnType<typeof setTimeout>;
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

export class LoginManager {
  private disposed = false;
  private flows = new Map<string, Login>();
  constructor(private models: MutableModels, private changed: () => void) {}

  start(providerId: string, type: AuthType) {
    if (this.disposed) {
      throw new Error("Provider connections are shutting down");
    }
    const provider = this.models.getProvider(providerId);
    if (!provider) throw new Error("Unknown provider");
    if (
      type === "oauth" ? !provider.auth.oauth : !provider.auth.apiKey?.login
    ) throw new Error("This sign-in method is not supported by the provider");
    this.cancelProvider(providerId);
    const id = crypto.randomUUID();
    const controller = new AbortController();
    const flow: Login = {
      id,
      providerId,
      status: "pending",
      events: [],
      controller,
      timer: setTimeout(() => {
        if (flow.status !== "pending") return;
        flow.status = "error";
        flow.error =
          "Sign-in expired after 10 minutes. Start a new connection from the provider options.";
        controller.abort();
        delete flow.prompt;
        delete flow.answer;
        if (!this.disposed) this.changed();
      }, 10 * 60_000),
    };
    this.flows.set(id, flow);
    void this.models.login(providerId, type, {
      signal: controller.signal,
      notify: (event) => {
        if (this.disposed || flow.status !== "pending") return;
        flow.events.push(event);
        if (flow.events.length > 30) flow.events.shift();
        this.changed();
      },
      prompt: (prompt) =>
        new Promise<string>((resolve, reject) => {
          const { signal: promptSignal, ...publicPrompt } = prompt;
          const signal = promptSignal
            ? AbortSignal.any([controller.signal, promptSignal])
            : controller.signal;
          if (signal.aborted) {
            reject(signal.reason);
            return;
          }
          const cleanup = () => {
            signal.removeEventListener("abort", abort);
            delete flow.answer;
            delete flow.prompt;
          };
          const abort = () => {
            cleanup();
            reject(signal.reason);
            if (!this.disposed) this.changed();
          };
          flow.prompt = { ...publicPrompt, id: crypto.randomUUID() };
          flow.answer = (answer) => {
            cleanup();
            resolve(answer);
            this.changed();
          };
          signal.addEventListener("abort", abort, { once: true });
          this.changed();
        }),
    }).then(() => {
      if (flow.status !== "pending") return;
      flow.status = controller.signal.aborted ? "cancelled" : "complete";
    }, () => {
      if (flow.status !== "pending") return;
      flow.status = controller.signal.aborted ? "cancelled" : "error";
      flow.error = controller.signal.aborted
        ? undefined
        : "Sign-in failed. Please retry or check your provider account.";
    }).finally(() => {
      clearTimeout(flow.timer);
      delete flow.prompt;
      delete flow.answer;
      if (this.disposed) return;
      this.changed();
      flow.cleanupTimer = setTimeout(() => {
        this.flows.delete(id);
        this.changed();
      }, 60_000);
      flow.cleanupTimer.unref();
    });
    return { id };
  }

  list(): LoginFlow[] {
    return [...this.flows.values()].map((
      {
        controller: _controller,
        answer: _answer,
        timer: _timer,
        cleanupTimer: _cleanupTimer,
        ...state
      },
    ) => state);
  }

  answer(id: string, promptId: string, value: string) {
    const flow = this.flows.get(id);
    if (!flow?.answer || flow.prompt?.id !== promptId) {
      throw new Error("Login prompt expired");
    }
    if (value.length > 32_000) throw new Error("Login response is too long");
    flow.answer(value);
  }

  cancel(id: string) {
    const flow = this.flows.get(id);
    if (!flow || flow.status !== "pending") return;
    flow.status = "cancelled";
    clearTimeout(flow.timer);
    flow.controller.abort();
    delete flow.prompt;
    delete flow.answer;
    if (!this.disposed) this.changed();
  }

  cancelProvider(providerId: string) {
    for (const flow of this.flows.values()) {
      if (flow.providerId === providerId) this.cancel(flow.id);
    }
  }

  dispose() {
    this.disposed = true;
    for (const flow of this.flows.values()) {
      clearTimeout(flow.timer);
      clearTimeout(flow.cleanupTimer);
      flow.controller.abort();
    }
    this.flows.clear();
  }
}
