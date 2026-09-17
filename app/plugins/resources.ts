import type {
  ResourceKind,
  ResourceReport,
  ResourceService,
  ResourceUsage,
} from "../sdk/resources.ts";

import { join, relative, resolve, sep } from "node:path";

import { definePlugin } from "../sdk/mod.ts";

const kinds: ResourceKind[] = ["snapshots", "artifacts", "media", "databases", "other"];

function classify(path: string): ResourceKind {
  const parts = path.split(sep);
  if (parts[0] === "artifacts") return "artifacts";
  if (parts[0] === "projects" && parts.length >= 3) {
    if (parts[2] === "shadow.git") return "snapshots";
    if (parts[2] === "media") return "media";
    if (parts.length === 3 && /^sessions\.db(?:-wal|-shm|-journal)?$/.test(parts[2]))
      return "databases";
  }
  return "other";
}

async function scan(root: string, signal: AbortSignal): Promise<ResourceReport> {
  const resources = kinds.map((kind): ResourceUsage => ({
    kind,
    bytes: 0,
    files: 0,
  }));
  const stack = [root];
  const deadline = Date.now() + 15_000;
  let visited = 0;
  let skipped = 0;
  let partial = false;
  while (stack.length) {
    signal.throwIfAborted();
    if (++visited > 100_000 || Date.now() >= deadline) {
      partial = true;
      break;
    }
    const path = stack.pop()!;
    try {
      const info = await Deno.lstat(path);
      if (info.isSymlink) {
        skipped++;
        continue;
      }
      if (info.isDirectory) {
        for await (const child of Deno.readDir(path)) {
          signal.throwIfAborted();
          if (stack.length + visited >= 100_000 || Date.now() >= deadline) {
            partial = true;
            break;
          }
          stack.push(join(path, child.name));
        }
      } else if (info.isFile) {
        const resource = resources.find((item) => item.kind === classify(relative(root, path)))!;
        resource.bytes += info.size;
        resource.files++;
      }
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof Deno.errors.NotFound) continue;
      skipped++;
      partial = true;
    }
  }
  return {
    resources,
    totalBytes: resources.reduce((sum, item) => sum + item.bytes, 0),
    scannedAt: Date.now(),
    partial,
    skipped,
  };
}

export function resourcesPlugin(home: string) {
  return definePlugin({
    id: "fathom:resources",
    apiVersion: 1,
    backend: {
      requires: ["rpc"],
      provides: ["resources"],
      activate(ctx) {
        const root = resolve(home);
        const controller = new AbortController();
        let scanning: Promise<ResourceReport> | undefined;
        const service: ResourceService = {
          scan() {
            return (scanning ??= scan(root, controller.signal).finally(() => {
              scanning = undefined;
            }));
          },
          async open(kind) {
            if (!kinds.includes(kind)) {
              throw new Error("Unknown storage resource");
            }
            const path =
              kind === "artifacts"
                ? join(root, "artifacts")
                : kind === "other"
                  ? root
                  : join(root, "projects");
            const info = await Deno.lstat(path).catch((error) => {
              if (error instanceof Deno.errors.NotFound) {
                throw new Error("Nothing is stored in this resource folder yet.");
              }
              throw error;
            });
            if (!info.isDirectory || info.isSymlink) {
              throw new Error("The resource folder is not available.");
            }
            const command =
              Deno.build.os === "darwin"
                ? "open"
                : Deno.build.os === "windows"
                  ? "explorer.exe"
                  : "xdg-open";
            const result = await new Deno.Command(command, {
              args: [path],
              stdout: "null",
              stderr: "piped",
            }).output();
            if (!result.success) {
              throw new Error("Could not open the resource folder in the file manager.");
            }
          },
        };
        ctx.provide("resources", service);
        const disposers = [
          ctx.get("rpc").register("resources.scan", () => service.scan()),
          ctx
            .get("rpc")
            .register("resources.open", (params) =>
              service.open(String(params.kind) as ResourceKind),
            ),
        ];
        ctx.effect(() => () => {
          controller.abort();
          for (const dispose of disposers) dispose();
        });
      },
    },
  });
}
