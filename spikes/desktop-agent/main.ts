/// <reference lib="deno.desktop" />

import { extname, join, relative, resolve } from "node:path";
import type {
  BootstrapPayload,
  EngineCommand,
  EngineToHost,
  HostToEngine,
  RendererState,
  RuntimeEvent,
  RuntimeSnapshot,
} from "./protocol.ts";

interface DesktopBindings {
  bootstrap(): Promise<BootstrapPayload>;
  command(command: EngineCommand): Promise<unknown>;
  reloadExtensions(state: RendererState): Promise<void>;
}

const sourceRoot = import.meta.dirname!;
const workspace = await Deno.realPath(
  resolve(Deno.args[0] ?? join(sourceRoot, "fixture-workspace")),
);
const dataDir = resolve(Deno.env.get("FATHOM_DATA_DIR") ?? join(sourceRoot, ".data"));
const model = Deno.env.get("FATHOM_MODEL") ?? "gpt-5.6-sol";
const extensionRoot = join(workspace, ".fathom", "extensions");

const window = new Deno.BrowserWindow<DesktopBindings>({
  title: "Fathom Runtime Prototype",
  width: 1240,
  height: 820,
  resizable: true,
});

async function fileResponse(path: string): Promise<Response> {
  const contentTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  };
  return new Response(await Deno.readFile(path), {
    headers: {
      "content-type": contentTypes[extname(path)] ?? "application/octet-stream",
      "cache-control": "no-store",
    },
  });
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

class EngineHost {
  private generation = 0;
  private worker?: Worker;
  private snapshot?: RuntimeSnapshot;
  private readyPromise?: Promise<RuntimeSnapshot>;
  private resolveReady?: (snapshot: RuntimeSnapshot) => void;
  private rejectReady?: (error: Error) => void;
  private pending = new Map<
    string,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();

  constructor(
    private readonly workspace: string,
    private readonly dataDir: string,
    private readonly model: string,
    private readonly publish: (event: RuntimeEvent) => void,
  ) {}

  start(): Promise<RuntimeSnapshot> {
    this.generation += 1;
    const generation = this.generation;
    this.readyPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    const worker = new Worker(new URL("./engine/worker.ts", import.meta.url).href, {
      type: "module",
    });
    this.worker = worker;
    worker.onmessage = (event: MessageEvent<EngineToHost>) => this.receive(event.data, generation);
    worker.onerror = (event) => {
      event.preventDefault();
      this.rejectReady?.(new Error(event.message));
      this.publish({
        type: "notice",
        level: "error",
        message: `Engine worker failed: ${event.message}`,
      });
    };
    const init: HostToEngine = {
      type: "init",
      generation,
      workspace: this.workspace,
      dataDir: this.dataDir,
      model: this.model,
    };
    worker.postMessage(init);
    return this.readyPromise;
  }

  ready(): Promise<RuntimeSnapshot> {
    if (!this.readyPromise) throw new Error("Engine has not started");
    return this.readyPromise;
  }

  command(command: EngineCommand): Promise<unknown> {
    if (!this.worker) return Promise.reject(new Error("Engine is unavailable"));
    const requestId = crypto.randomUUID();
    const request: HostToEngine = {
      type: "request",
      generation: this.generation,
      requestId,
      command,
    };
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.worker!.postMessage(request);
    });
  }

  async reload(): Promise<void> {
    await this.command({ type: "prepare_reload" });
    this.terminate(new Error("Engine reloaded"));
    await this.start();
  }

  terminate(reason = new Error("Engine stopped")): void {
    this.worker?.terminate();
    this.worker = undefined;
    for (const request of this.pending.values()) request.reject(reason);
    this.pending.clear();
  }

  private receive(message: EngineToHost, expectedGeneration: number): void {
    if (message.generation !== this.generation || message.generation !== expectedGeneration) return;
    if (message.type === "ready") {
      this.snapshot = message.snapshot;
      this.resolveReady?.(message.snapshot);
      this.publish({ type: "snapshot", snapshot: message.snapshot });
      return;
    }
    if (message.type === "event") {
      if (message.event.type === "snapshot") this.snapshot = message.event.snapshot;
      this.publish(message.event);
      return;
    }
    const request = this.pending.get(message.requestId);
    if (!request) return;
    this.pending.delete(message.requestId);
    if (message.ok) request.resolve(message.value);
    else request.reject(new Error(message.error ?? "Engine command failed"));
  }
}

let rendererState: RendererState = { draft: "", extensionsOpen: true };
const engine = new EngineHost(workspace, dataDir, model, (event) => {
  void window.executeJs(`globalThis.fathomReceive?.(${safeJson(event)})`).catch(() => {});
});
await engine.start();

window.bind("bootstrap", async () => ({ snapshot: await engine.ready(), rendererState }));
window.bind("command", (command) => engine.command(command));
window.bind("reloadExtensions", async (state) => {
  rendererState = state;
  await engine.reload();
  setTimeout(() => window.reload(), 40);
});

window.addEventListener("close", () => engine.terminate());

Deno.serve(async (request) => {
  const url = new URL(request.url);
  try {
    if (url.pathname.startsWith("/__workspace__/")) {
      const relativePath = url.pathname.slice("/__workspace__/".length).split("/").map(
        decodeURIComponent,
      ).join("/");
      const path = resolve(workspace, relativePath);
      const rel = relative(extensionRoot, path);
      if (rel.startsWith("..") || rel === "" || rel.includes("\0")) {
        return new Response("Forbidden", { status: 403 });
      }
      return await fileResponse(path);
    }
    const route = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (!new Set(["index.html", "app.js", "styles.css"]).has(route)) {
      return new Response("Not found", { status: 404 });
    }
    return await fileResponse(join(sourceRoot, "renderer", route));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return new Response("Not found", { status: 404 });
    return new Response("Internal error", { status: 500 });
  }
});
