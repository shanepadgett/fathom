import type {
  Dispose,
  EditorLanguageContribution,
  EntryMount,
  FrontendHost,
  FrontendPlugin,
  ViewMount,
  ViewSlot,
} from "../sdk/frontend.ts";
import type { Entry, SessionState } from "../sdk/session.ts";
import type { UIComponent, UIComponentRegistry } from "../sdk/ui-components.ts";
import type { CommandShortcut } from "./command-shortcut.ts";
import type { Transport } from "./transport.ts";

import {
  commandShortcut,
  reservedShortcut,
  shortcutIdentity,
  shortcutMatches,
} from "./command-shortcut.ts";
import { builtinComponents } from "./components/builtin-ui.tsx";

interface View {
  id: string;
  title: string;
  slot: ViewSlot;
  mount: ViewMount;
}
interface Command {
  id: string;
  title: string;
  shortcut?: string;
  binding?: CommandShortcut;
  run(): void | Promise<void>;
}
interface Renderer {
  id: string;
  matches(entry: Entry): boolean;
  mount: EntryMount;
}

export class UIHost implements FrontendHost {
  readonly views = new Map<string, View>();
  readonly commands = new Map<string, Command>();
  readonly renderers = new Map<string, Renderer>();
  readonly surfaces = new Map<string, ViewMount>();
  private components = new Map<string, UIComponent<unknown>>();
  private disposers: Dispose[] = [];
  private lifecycle: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private runningCommands = new Set<Command>();
  private generation = 0;
  private activation?: { active: boolean };

  constructor(
    private transport: Transport,
    readonly session: () => SessionState | undefined,
    readonly toast: (message: string) => void,
  ) {}

  private register<T>(map: Map<string, T>, key: string, value: T) {
    if (map.has(key)) throw new Error(`Duplicate UI contribution: ${key}`);
    map.set(key, value);
    this.changed();
    let active = true;
    const dispose = () => {
      if (!active) return;
      active = false;
      if (map.get(key) === value) {
        map.delete(key);
        this.changed();
      }
    };
    this.disposers.push(dispose);
    return dispose;
  }

  request<T>(method: string, params?: Record<string, unknown>) {
    return this.transport.request<T>(method, params);
  }
  get projectId() {
    return this.transport.projectId;
  }
  onEvent(listener: Parameters<Transport["onEvent"]>[0]) {
    const dispose = this.transport.onEvent(listener);
    this.disposers.push(dispose);
    return dispose;
  }
  registerView(view: View) {
    return this.register(this.views, view.id, view);
  }
  async registerLanguage(language: EditorLanguageContribution) {
    const projectId = this.projectId;
    const generation = this.generation;
    const activation = this.activation;
    const module = await import("./components/editor-languages.ts");
    if (generation !== this.generation || activation?.active === false) {
      throw new Error("Plugin scope was unloaded");
    }
    const dispose = module.registerLanguage(projectId, language);
    this.disposers.push(dispose);
    return dispose;
  }
  registerCommand(command: Command) {
    const binding = command.shortcut ? commandShortcut(command.shortcut) : undefined;
    if (binding) {
      if (reservedShortcut(binding)) {
        throw new Error(`Shortcut is reserved by Fathom or editing: ${command.shortcut}`);
      }
      for (const existing of this.commands.values()) {
        if (existing.binding && shortcutIdentity(existing.binding) === shortcutIdentity(binding)) {
          throw new Error(`Shortcut already belongs to ${existing.title}: ${command.shortcut}`);
        }
      }
    }
    return this.register(this.commands, command.id, { ...command, binding });
  }
  handleShortcut(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.repeat ||
      document.querySelector("dialog[open]")
    )
      return;
    for (const command of this.commands.values()) {
      if (!command.binding || !shortcutMatches(command.binding, event)) {
        continue;
      }
      event.preventDefault();
      if (this.runningCommands.has(command)) return;
      this.runningCommands.add(command);
      void Promise.resolve()
        .then(() => command.run())
        .catch((error) => {
          this.toast(
            `Command ${command.title} failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        })
        .finally(() => this.runningCommands.delete(command));
      return;
    }
  }
  registerEntryRenderer(renderer: Renderer) {
    return this.register(this.renderers, renderer.id, renderer);
  }
  registerSurfaceOverride(surface: "shell" | "transcript" | "editor", mount: ViewMount) {
    return this.register(this.surfaces, surface, mount);
  }
  ui: UIComponentRegistry = {
    registerComponent: <Props>(name: string, component: UIComponent<Props>) => {
      if (Object.hasOwn(builtinComponents, name)) {
        throw new Error(`Built-in UI component name is reserved: ${name}`);
      }
      return this.register(this.components, name, component as UIComponent<unknown>);
    },
    getComponent: ((name: string) =>
      this.components.get(name) ??
      (Object.hasOwn(builtinComponents, name)
        ? builtinComponents[name as keyof typeof builtinComponents]
        : undefined)) as UIComponentRegistry["getComponent"],
  };
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private changed() {
    for (const listener of this.listeners) listener();
  }

  private enqueue(operation: () => Promise<void>) {
    const pending = this.lifecycle.then(operation);
    this.lifecycle = pending.catch(() => {});
    return pending;
  }

  load() {
    return this.enqueue(() => this.activatePlugins());
  }

  private async activatePlugins() {
    ++this.generation;
    await this.release(this.disposers.splice(0));
    const entries =
      await this.request<{ id: string; url: string; css?: string }[]>("plugins.frontend");
    for (const entry of entries) {
      const checkpoint = this.disposers.length;
      const activation = { active: true };
      try {
        if (entry.css) {
          const stylesheet = document.createElement("link");
          stylesheet.rel = "stylesheet";
          stylesheet.href = `${entry.css}?v=${Date.now()}`;
          document.head.append(stylesheet);
          this.disposers.push(() => stylesheet.remove());
        }
        const module = await import(/* @vite-ignore */ `${entry.url}?v=${Date.now()}`);
        const plugin: FrontendPlugin = module.default?.frontend ?? module.default;
        if (typeof plugin?.activate !== "function") {
          throw new Error("Frontend plugin must export activate(host)");
        }
        this.activation = activation;
        this.disposers.push(() => {
          activation.active = false;
        });
        const dispose = await plugin.activate(this);
        if (typeof dispose === "function") this.disposers.push(dispose);
      } catch (error) {
        activation.active = false;
        await this.release(this.disposers.splice(checkpoint));
        this.toast(
          `Could not load ${entry.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        if (this.activation === activation) this.activation = undefined;
      }
    }
  }

  private async release(disposers: Dispose[]) {
    for (const dispose of disposers.reverse()) {
      try {
        await dispose();
      } catch (error) {
        this.toast(
          `Plugin cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  dispose() {
    return this.enqueue(() => {
      ++this.generation;
      return this.release(this.disposers.splice(0));
    });
  }
}
