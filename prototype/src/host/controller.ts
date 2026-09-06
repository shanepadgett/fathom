import { relative, resolve } from "node:path";
import type { HarnessEvent } from "../contracts/session.ts";
import { PluginHost } from "../kernel/host.ts";
import { compose } from "./composition.ts";
import type { AppConfig } from "./config.ts";
export class BusyError extends Error {}
export class Controller {
  private host = new PluginHost();
  private abort?: AbortController;
  private work?: Promise<void>;
  private switching = false;
  private listeners = new Set<(event: HarnessEvent) => void>();
  private unsubscribe?: () => void;
  private uiPlugins: string[] = [];
  private assets = new Map<string, string>();
  constructor(private config: AppConfig) {}
  async init() {
    const { plugins, uiPlugins, assets } = await compose(this.config);
    await this.host.mount(plugins);
    // Require the application-facing contracts; additional services are optional.
    for (const key of ["runtime", "sessions", "tools", "workspace"] as const) {
      this.host.get(key);
    }
    this.uiPlugins = uiPlugins;
    this.assets = assets;
    this.unsubscribe = this.host.get("sessions").subscribe((event) => {
      for (const listener of this.listeners) listener(event);
    });
  }
  bootstrap() {
    let model = { provider: "none", id: "none" };
    try {
      model = this.host.get("model").info;
    } catch { /* A runtime may not use an LLM. */ }
    return {
      workspace: this.host.get("workspace").root,
      model,
      runtime: this.host.get("runtime").id,
      plugins: this.host.describe(),
      tools: this.host.get("tools").list().map(({ name, description }) => ({
        name,
        description,
      })),
      uiPlugins: this.uiPlugins,
      session: this.host.get("sessions").snapshot(),
      profiles: this.config.composition ? [] : ["default", "echo"],
      profile: this.config.profile,
    };
  }
  asset(path: string): string | undefined {
    for (const [prefix, root] of this.assets) {
      if (!path.startsWith(prefix)) continue;
      const file = resolve(root, path.slice(prefix.length));
      if (relative(root, file).startsWith("..")) return undefined;
      return file;
    }
  }
  subscribe(listener: (event: HarnessEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private assertIdle() {
    if (this.work || this.switching) {
      throw new BusyError(
        "Wait for the current run or composition change to finish.",
      );
    }
  }
  send(text: string) {
    this.assertIdle();
    if (!text.trim()) throw new Error("Message cannot be empty");
    const sessions = this.host.get("sessions");
    const runtime = this.host.get("runtime");
    this.abort = new AbortController();
    const signal = this.abort.signal;
    sessions.status("running");
    this.work = Promise.resolve().then(() => runtime.run(text, signal)).then(
      () => {
        sessions.status(signal.aborted ? "cancelled" : "idle");
      },
    ).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!signal.aborted) {
        sessions.append({ role: "system", text: message, isError: true });
        sessions.publish({ type: "error", message });
      }
      sessions.status(signal.aborted ? "cancelled" : "error");
    }).finally(() => {
      this.work = undefined;
      this.abort = undefined;
    });
  }
  cancel() {
    this.abort?.abort(new Error("Cancelled by user"));
  }
  async wait() {
    await this.work;
  }
  reset() {
    this.assertIdle();
    this.host.get("sessions").reset();
  }
  async switchProfile(profile: string) {
    this.assertIdle();
    if (this.config.composition) {
      throw new Error("Custom composition selected; edit it and restart.");
    }
    if (!["default", "echo"].includes(profile)) {
      throw new Error("Unknown profile");
    }
    this.switching = true;
    const previous = this.host;
    const previousConfig = this.config;
    try {
      const replacement = new PluginHost();
      const nextConfig = { ...this.config, profile };
      const { plugins, uiPlugins, assets } = await compose(nextConfig);
      await replacement.mount(plugins);
      this.unsubscribe?.();
      this.host = replacement;
      this.config = nextConfig;
      this.uiPlugins = uiPlugins;
      this.assets = assets;
      this.unsubscribe = replacement.get("sessions").subscribe((event) => {
        for (const listener of this.listeners) listener(event);
      });
      await previous.dispose();
      replacement.get("sessions").publish({
        type: "snapshot",
        session: replacement.get("sessions").snapshot(),
      });
    } catch (error) {
      if (this.host === previous) this.config = previousConfig;
      throw error;
    } finally {
      this.switching = false;
    }
  }
  async dispose() {
    this.cancel();
    await this.wait();
    this.unsubscribe?.();
    await this.host.dispose();
    this.listeners.clear();
  }
}
