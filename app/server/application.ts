import type { ModelChoice } from "../sdk/models.ts";
import type { WorkspaceLayout } from "../sdk/layout.ts";
import { savedSessions } from "../plugins/storage/catalog.ts";
import type { AppEvent } from "../sdk/mod.ts";
import type { BrowserFactory } from "../plugins/browser/connection.ts";

import { basename } from "node:path";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";

import { ProjectRegistry } from "../kernel/registry.ts";
import { atomicWrite, readJson } from "../kernel/files.ts";
import { Environment } from "./environment.ts";

export class Application {
  browserConnection?: BrowserFactory;
  readonly projects: ProjectRegistry;
  readonly environments = new Map<string, Environment>();
  private opening: Promise<void> = Promise.resolve();
  private appearanceWriting: Promise<void> = Promise.resolve();
  private closing = false;
  private disposal?: Promise<void>;
  readonly listeners = new Set<(event: AppEvent) => void>();

  constructor(readonly home: string, readonly authPath: string) {
    this.projects = new ProjectRegistry(home);
  }

  publish = (event: AppEvent) => {
    for (const listener of this.listeners) listener(event);
  };

  open(path: string) {
    if (this.closing) {
      return Promise.reject(new Error("Application is shutting down"));
    }
    const pending = this.opening.then(async () => {
      const project = await this.projects.open(path);
      if (!this.environments.has(project.id)) {
        const environment = new Environment(
          project,
          this.home,
          this.authPath,
          this.publish,
          (event) => this.browserConnection?.(event),
        );
        try {
          await environment.initialize();
        } catch (error) {
          try {
            await environment.dispose();
          } catch (cleanup) {
            throw new AggregateError(
              [error, cleanup],
              "Workspace initialization and cleanup failed",
            );
          }
          throw error;
        }
        this.environments.set(project.id, environment);
        this.publish({ type: "environment", projectId: project.id });
      }
      return project;
    });
    this.opening = pending.then(() => {}, () => {});
    return pending;
  }

  async request(method: string, params: Record<string, unknown> = {}) {
    if (this.closing) throw new Error("Application is shutting down");
    if (method === "appearance.get") {
      await this.appearanceWriting;
      return readJson(join(this.home, "appearance.json"), { theme: "dark" });
    }
    if (method === "appearance.set") {
      if (params.theme !== "dark" && params.theme !== "light") {
        throw new Error("Unknown color theme");
      }
      const theme = params.theme;
      const writing = this.appearanceWriting.then(() =>
        atomicWrite(
          join(this.home, "appearance.json"),
          JSON.stringify({ theme }),
        )
      );
      this.appearanceWriting = writing.then(() => {}, () => {});
      await writing;
      return {};
    }
    if (method === "sessions.catalog") {
      return savedSessions(this.home, this.projects.list());
    }
    if (method === "projects.list") return this.projects.list();
    if (method === "projects.open") return await this.open(String(params.path));
    const environment = this.environments.get(String(params.projectId));
    if (!environment) throw new Error("Open a project first");
    await environment.whenReady();
    const { host, project } = environment;
    const storage = host.get("storage"),
      runtime = host.get("runtime"),
      models = host.get("model").models;
    const id = String(params.sessionId);
    switch (method) {
      case "project.trust": {
        if (typeof params.trusted !== "boolean") {
          throw new Error("Supply a trust decision");
        }
        const changed = project.trusted !== params.trusted;
        await this.projects.setTrust(project.id, params.trusted);
        project.trusted = params.trusted;
        project.trustReviewed = true;
        if (changed) await environment.reload();
        return project;
      }
      case "sessions.list":
        return storage.listSessions();
      case "session.selection.get":
        return storage.setting<string | null>("selectedSession", null);
      case "session.selection.set":
        storage.getSession(id);
        storage.setSetting("selectedSession", id);
        return {};
      case "session.create":
        return storage.createSession();
      case "session.get":
        return runtime.state(id);
      case "session.draft.get": {
        storage.getSession(id);
        return storage.setting(`draft:${id}`, "");
      }
      case "session.draft.set": {
        storage.getSession(id);
        if (typeof params.text !== "string" || params.text.length > 4_000_000) {
          throw new Error("Draft must be text no larger than 4 MB.");
        }
        storage.setSetting(`draft:${id}`, params.text);
        return {};
      }
      case "session.update": {
        const input = params.changes;
        if (!input || typeof input !== "object" || Array.isArray(input)) {
          throw new Error("Session changes must be an object");
        }
        const values = input as Record<string, unknown>;
        const changes: Record<string, unknown> = {};
        if (typeof values.title === "string") {
          changes.title = values.title.slice(0, 200);
        }
        if (typeof values.pinned === "boolean") changes.pinned = values.pinned;
        if (typeof values.archived === "boolean") {
          changes.archived = values.archived;
        }
        if (
          ["default", "read-only", "no-terminal"].includes(
            String(values.toolPolicy),
          )
        ) changes.toolPolicy = values.toolPolicy;
        if (
          ["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(
            String(values.thinking),
          )
        ) changes.thinking = values.thinking;
        const updated = storage.updateSession(id, changes);
        this.publish({ type: "session", projectId: project.id, sessionId: id });
        return updated;
      }
      case "session.submit": {
        const mediaIds = params.media ?? [];
        if (
          !Array.isArray(mediaIds) || mediaIds.length > 4 ||
          mediaIds.some((value) => typeof value !== "string")
        ) throw new Error("Provide up to four draft media IDs");
        const media = mediaIds.length
          ? environment.host.get("media")
          : undefined;
        const attachments = mediaIds.map((assetId) => {
          const asset = media!.draft(id).find((asset) => asset.id === assetId);
          if (!asset) {
            throw new Error("A draft attachment is no longer available");
          }
          return { type: "media", data: asset };
        });
        const mode = params.mode ?? storage.setting("defaultInput", "steer");
        await runtime.submit(
          id,
          String(params.text),
          mode === "follow_up" ? "follow_up" : "steer",
          attachments,
        );
        media?.releaseDraft(id, mediaIds);
        return { accepted: true };
      }
      case "queue.send":
        await runtime.sendQueued(id, String(params.id));
        return { accepted: true };
      case "queue.update":
        if (params.text !== null && typeof params.text !== "string") {
          throw new Error("Provide message text or null to remove it");
        }
        runtime.updateQueued(id, String(params.id), params.text);
        return { accepted: true };
      case "session.stop":
        runtime.abort(id);
        return { accepted: true };
      case "session.continue":
        await runtime.resume(id);
        return { accepted: true };
      case "providers.list":
        return await Promise.all(
          models.getProviders().map(async (provider) => {
            const auth = await models.checkAuth(provider.id).catch(() =>
              undefined
            );
            return {
              id: provider.id,
              name: provider.name,
              connected: !!auth,
              source: auth?.source,
              methods: [
                ...(provider.auth.oauth
                  ? [{ id: "oauth", name: provider.auth.oauth.name }]
                  : []),
                ...(provider.auth.apiKey?.login
                  ? [{ id: "api_key", name: provider.auth.apiKey.name }]
                  : []),
              ],
            };
          }),
        );
      case "models.list":
        return (await models.getAvailable()).map((model) => ({
          id: model.id,
          provider: model.provider,
          name: model.name,
          contextWindow: model.contextWindow,
          thinkingLevels: getSupportedThinkingLevels(model),
          reasoning: model.reasoning,
        } satisfies ModelChoice));
      case "credentials.info":
        return {
          path: this.authPath,
          sharedWithPi: this.authPath.includes("/.pi/"),
        };
      case "provider.login":
        return environment.login.start(
          String(params.providerId),
          params.type === "oauth" ? "oauth" : "api_key",
        );
      case "provider.flows":
        return environment.login.list();
      case "provider.answer":
        environment.login.answer(
          String(params.id),
          String(params.promptId),
          String(params.answer),
        );
        return {};
      case "provider.cancel":
        environment.login.cancel(String(params.id));
        return {};
      case "provider.logout":
        environment.login.cancelProvider(String(params.providerId));
        await models.logout(String(params.providerId));
        return {};
      case "model.select": {
        const provider = String(params.provider), model = String(params.model);
        if (!models.getModel(provider, model)) {
          throw new Error("Model not found");
        }
        const session = storage.getSession(id);
        if (["running", "retry_waiting", "approval"].includes(session.status)) {
          throw new Error("Stop the current run before changing its model");
        }
        if (
          session.activeLeafId && session.provider &&
          session.provider !== provider
        ) throw new Error("Fork the session before switching providers");
        storage.updateSession(id, { provider, model });
        storage.setSetting("provider", provider);
        storage.setSetting("model", model);
        return {};
      }
      case "plugins.list":
        return host.describe();
      case "plugins.frontend":
        return await Promise.all(
          [...environment.assets].map(async ([id, path]) => {
            const base = `/extensions/${project.id}/${encodeURIComponent(id)}`;
            const css = await access(join(dirname(path), "plugin.css")).then(
              () => `${base}/plugin.css`,
              () => undefined,
            );
            return {
              id,
              url: `${base}/${encodeURIComponent(basename(path))}`,
              css,
            };
          }),
        );
      case "plugins.reload":
        await environment.reload();
        return {};
      case "approvals.list":
        return host.get("approvals").list();
      case "approval.resolve":
        host.get("approvals").resolve(
          String(params.id),
          params.approved === true,
        );
        return {};
      case "usage.list":
        return storage.usage();
      case "settings.layout.get":
        return storage.setting<WorkspaceLayout>("workspaceLayout", {
          browserBeside: false,
        });
      case "settings.layout.set": {
        const value = params.value as Partial<WorkspaceLayout> | undefined;
        if (
          !value || typeof value !== "object" || Array.isArray(value) ||
          typeof value.browserBeside !== "boolean" ||
          (value.editorBrowserWidth !== undefined &&
            (!Number.isFinite(value.editorBrowserWidth) ||
              value.editorBrowserWidth <= 0 ||
              value.editorBrowserWidth > 100_000))
        ) {
          throw new Error("Invalid workspace layout");
        }
        storage.setSetting("workspaceLayout", {
          browserBeside: value.browserBeside,
          ...(value.editorBrowserWidth !== undefined
            ? { editorBrowserWidth: value.editorBrowserWidth }
            : {}),
        });
        return {};
      }
      case "settings.get":
        return storage.setting("ui", {
          theme: "dark",
          density: "compact",
          defaultInput: "steer",
          notifications: "background_only",
        });
      case "settings.set":
        storage.setSetting("ui", params.value);
        return {};
      case "settings.runtime.get":
        return {
          toolExecution: storage.setting("toolExecution", "adaptive"),
          maxSteps: storage.setting("maxSteps", 200),
          expertProvider: storage.setting("expertProvider", ""),
          expertModel: storage.setting("expertModel", ""),
          defaultInput: storage.setting("defaultInput", "steer"),
          notifications: storage.setting("notifications", "background_only"),
          audio: storage.setting("audio", false),
          audioCues: storage.setting("audioCues", {
            success: true,
            approval: true,
            error: true,
          }),
          volume: storage.setting("volume", 0.25),
        };
      case "settings.runtime.set": {
        if (
          ["adaptive", "sequential", "parallel"].includes(
            String(params.toolExecution),
          )
        ) storage.setSetting("toolExecution", params.toolExecution);
        if (
          Number.isInteger(params.maxSteps) && Number(params.maxSteps) >= 1 &&
          Number(params.maxSteps) <= 10_000
        ) storage.setSetting("maxSteps", params.maxSteps);
        for (const key of ["expertProvider", "expertModel"]) {
          if (typeof params[key] === "string") {
            storage.setSetting(key, params[key]);
          }
        }
        if (["steer", "follow_up"].includes(String(params.defaultInput))) {
          storage.setSetting("defaultInput", params.defaultInput);
        }
        if (
          ["background_only", "always", "muted"].includes(
            String(params.notifications),
          )
        ) storage.setSetting("notifications", params.notifications);
        if (params.audioCues && typeof params.audioCues === "object") {
          const values = params.audioCues as Record<string, unknown>;
          const cues = Object.fromEntries(
            ["success", "approval", "error"].map((
              key,
            ) => [key, values[key] !== false]),
          );
          storage.setSetting("audioCues", cues);
        }
        if (typeof params.audio === "boolean") {
          storage.setSetting("audio", params.audio);
        }
        if (
          typeof params.volume === "number" && params.volume >= 0 &&
          params.volume <= 1
        ) storage.setSetting("volume", params.volume);
        return {};
      }
      default:
        return await host.get("rpc").invoke(method, params);
    }
  }

  dispose() {
    if (this.disposal) return this.disposal;
    this.closing = true;
    this.disposal = this.shutdown();
    return this.disposal;
  }

  private async shutdown() {
    await this.opening;
    await this.appearanceWriting;
    const results = await Promise.allSettled(
      [...this.environments.values()].map((environment) =>
        environment.dispose()
      ),
    );
    this.environments.clear();
    await this.projects.close();
    const errors = results.filter((result) => result.status === "rejected").map(
      (result) => result.reason,
    );
    if (errors.length) {
      throw new AggregateError(errors, "Workspace cleanup failed");
    }
  }
}
