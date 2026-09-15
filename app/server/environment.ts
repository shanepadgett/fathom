import type { AppEvent, FathomPlugin, Project } from "../sdk/mod.ts";
import type { BrowserFactory } from "../plugins/browser/connection.ts";

import { join } from "node:path";

import { discover } from "../kernel/discovery.ts";
import { createPluginCache, prunePluginCache } from "../kernel/plugin-cache.ts";
import { watchPlugins } from "../kernel/plugin-watcher.ts";
import { orderPlugins, PluginHost } from "../kernel/host.ts";
import { compileFrontend } from "../kernel/frontend.ts";
import { feedback, feedbackIntegration } from "../plugins/feedback.ts";
import { artifactIntegration } from "../plugins/artifact-integration.ts";
import { artifactsPlugin } from "../plugins/artifacts.ts";
import { media } from "../plugins/media.ts";
import { mediaContext } from "../plugins/media-context.ts";
import git from "../plugins/git.ts";
import { browserPlugin } from "../plugins/browser/index.ts";
import delegation from "../plugins/delegation.ts";
import { skillsPlugin } from "../plugins/skills.ts";
import compaction from "../plugins/compaction.ts";
import approvals from "../plugins/approvals.ts";
import branches from "../plugins/branches.ts";
import editor from "../plugins/editor/index.ts";
import diagnosticReview from "../plugins/diagnostic-review.ts";
import terminal from "../plugins/terminal.ts";
import devServers from "../plugins/dev-servers.ts";
import mcp from "../plugins/mcp.ts";
import rpc from "../plugins/rpc.ts";
import snapshots from "../plugins/snapshots.ts";
import { contextPlugin } from "../plugins/context.ts";
import { providersPlugin } from "../plugins/providers/index.ts";
import { imagesPlugin } from "../plugins/providers/images.ts";
import { nativeImages } from "../plugins/providers/native-images.ts";
import { LoginManager } from "../plugins/providers/login.ts";
import runtime from "../plugins/runtime/index.ts";
import storage from "../plugins/storage/index.ts";
import { resourcesPlugin } from "../plugins/resources.ts";
import files from "../plugins/tools/files.ts";
import commands from "../plugins/tools/commands.ts";
import registry from "../plugins/tools/registry.ts";
import { workspacePlugin } from "../plugins/workspace.ts";
import { definePlugin } from "../sdk/mod.ts";

interface PreparedEnvironment {
  directory: string;
  plugins: FathomPlugin[];
  assets: Map<string, string>;
  watch: { roots: string[]; directories: string[] };
}

let environmentGeneration = 0;

export class Environment {
  host = new PluginHost();
  login!: LoginManager;
  assets = new Map<string, string>();
  private generation = 0;
  private prepared?: PreparedEnvironment;
  private stopWatching?: () => void;
  private watchTimer?: ReturnType<typeof setTimeout>;
  private pendingReload = false;
  private reloading?: Promise<void>;
  private cacheDirectories = new Set<string>();

  constructor(
    readonly project: Project,
    readonly home: string,
    readonly authPath: string,
    readonly publish: (event: AppEvent) => void,
    readonly createBrowser?: BrowserFactory,
  ) {}

  async initialize() {
    await prunePluginCache(
      join(this.home, "cache", "plugins", this.project.id),
    );
    await this.activate(await this.prepare());
  }

  private async prepare(): Promise<PreparedEnvironment> {
    const directory = await createPluginCache(join(
      this.home,
      "cache",
      "plugins",
      this.project.id,
    ));
    this.cacheDirectories.add(directory);
    try {
      return await this.prepareIn(directory);
    } catch (error) {
      await this.removeCache(directory);
      throw error;
    }
  }

  private async removeCache(directory: string) {
    try {
      await Deno.remove(directory, { recursive: true });
      this.cacheDirectories.delete(directory);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        this.cacheDirectories.delete(directory);
      } else console.error("Could not remove generated plugin cache", error);
    }
  }

  private async prepareIn(directory: string): Promise<PreparedEnvironment> {
    const events = definePlugin({
      id: "fathom:events",
      apiVersion: 1,
      backend: {
        provides: ["events"],
        activate: (ctx) => {
          const listeners = new Set<(event: AppEvent) => void>();
          ctx.effect(() => () => listeners.clear());
          ctx.provide("events", {
            publish: (event) => {
              const scoped = { ...event, projectId: this.project.id };
              this.publish(scoped);
              for (const listener of [...listeners]) {
                try {
                  listener(scoped);
                } catch (error) {
                  console.error("Project event subscriber failed", error);
                }
              }
            },
            subscribe: (listener) => {
              listeners.add(listener);
              return () => {
                listeners.delete(listener);
              };
            },
          });
        },
      },
    });
    const extensions = await discover(
      this.home,
      this.project.path,
      this.project.trusted,
      this.generation = ++environmentGeneration,
      join(directory, "backend"),
    );
    const builtin = [
      events,
      workspacePlugin(this.project, this.home),
      storage,
      resourcesPlugin(this.home),
      providersPlugin(this.authPath),
      imagesPlugin(this.authPath),
      nativeImages,
      registry,
      rpc,
      contextPlugin(this.home),
      files,
      commands,
      snapshots,
      approvals,
      runtime,
      editor,
      diagnosticReview,
      branches,
      terminal,
      devServers,
      mcp,
      compaction,
      artifactsPlugin(this.home),
      artifactIntegration,
      feedback,
      feedbackIntegration,
      media,
      mediaContext,
      skillsPlugin(this.home),
      delegation,
      git,
      browserPlugin(this.home, this.createBrowser),
    ];
    const assets = extensions.assets;
    const plugins = orderPlugins(
      [...builtin, ...extensions.plugins].filter((plugin) =>
        !extensions.disables.has(plugin.id)
      ),
    );
    for (const [id, entry] of assets) {
      const frontendDirectory = join(
        directory,
        "frontend",
        encodeURIComponent(id),
      );
      assets.set(id, await compileFrontend(entry, frontendDirectory));
    }
    return { directory, plugins, assets, watch: extensions.watch };
  }

  private async activate(prepared: PreparedEnvironment) {
    this.host = new PluginHost();
    await this.host.mount(prepared.plugins);
    this.login = new LoginManager(
      this.host.get("model").models,
      () => this.publish({ type: "providers", projectId: this.project.id }),
    );
    this.host.context.on("session:idle", () => {
      if (this.pendingReload) this.notifyReload();
    });
    this.stopWatching = await watchPlugins(
      prepared.watch,
      () => {
        clearTimeout(this.watchTimer);
        this.watchTimer = setTimeout(() => {
          const runtime = this.host.get("runtime");
          const running = this.host.get("storage").listSessions().some((
            session,
          ) =>
            ["running", "retry_waiting", "approval"].includes(
              runtime.state(session.id).session.status,
            )
          );
          if (running) this.pendingReload = true;
          else this.notifyReload();
        }, 250);
      },
      () =>
        this.publish({
          type: "error",
          data: { message: "Plugin watching stopped" },
        }),
    );
    this.assets = prepared.assets;
    this.prepared = prepared;
    this.pendingReload = false;
  }

  private notifyReload() {
    this.pendingReload = false;
    this.publish({ type: "plugins-changed", projectId: this.project.id });
  }

  async whenReady() {
    await this.reloading;
  }

  reload() {
    if (this.reloading) return this.reloading;
    this.reloading = this.performReload().finally(() => {
      this.reloading = undefined;
    });
    return this.reloading;
  }

  private async performReload() {
    const next = await this.prepare();
    const previous = this.prepared!;
    const runtime = this.host.get("runtime");
    await Promise.all(
      this.host.get("storage").listSessions().map((session) =>
        runtime.whenIdle(session.id)
      ),
    );
    try {
      await this.stopHost();
      await this.activate(next);
    } catch (error) {
      try {
        await this.stopHost();
        await this.activate(previous);
        await this.removeCache(next.directory);
        this.publish({ type: "environment", projectId: this.project.id });
      } catch (recovery) {
        throw new AggregateError(
          [error, recovery],
          "Plugin reload and recovery failed. Restart Fathom after fixing the plugin.",
        );
      }
      throw new Error(
        `Plugin reload failed; the previous environment was restored. ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
    await this.removeCache(previous.directory);
    this.publish({ type: "environment", projectId: this.project.id });
  }

  async dispose() {
    await this.stopHost();
    await Promise.all(
      [...this.cacheDirectories].map((directory) =>
        this.removeCache(directory)
      ),
    );
  }

  private async stopHost() {
    clearTimeout(this.watchTimer);
    this.stopWatching?.();
    this.stopWatching = undefined;
    this.login?.dispose();
    await this.host.dispose();
  }
}
