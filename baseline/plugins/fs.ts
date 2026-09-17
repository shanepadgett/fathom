/** Disk I/O inside the workspace jail. No hashes. Editor and file tools inject this. */
import type { PluginContext } from "../sdk.ts";
import type { FileEntry } from "../types.ts";

import { dirname } from "@std/path";
import { Service } from "cordis";

const ignore = new Set(["node_modules", ".git", "dist", "coverage", ".cache"]);
const treeLimit = 1500;

declare module "../sdk.ts" {
  interface Services {
    fs: Fs;
  }
}

export default class Fs extends Service {
  static inject = ["workspace"] as const;
  static provide = "fs" as const;
  declare ctx: PluginContext<"workspace">;

  constructor(ctx: PluginContext<"workspace">) {
    super(ctx, "fs");
  }

  async readText(path: string) {
    const full = this.ctx.workspace.resolve(path);
    if ((await Deno.stat(full)).size > 8_000_000) {
      throw new Error("File exceeds 8 MB");
    }
    const text = await Deno.readTextFile(full);
    if (text.includes("\0")) throw new Error("Binary file");
    return text;
  }

  async replace(path: string, content: string) {
    const full = this.ctx.workspace.resolve(path);
    await Deno.mkdir(dirname(full), { recursive: true });
    const temporary = `${full}.${crypto.randomUUID()}.tmp`;
    await Deno.writeTextFile(temporary, content);
    await Deno.rename(temporary, full);
  }

  async exists(path: string) {
    try {
      await Deno.stat(this.ctx.workspace.resolve(path));
      return true;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return false;
      throw error;
    }
  }

  async tree(path = ".") {
    let count = 0;
    const walk = async (relative: string): Promise<FileEntry[]> => {
      const full = this.ctx.workspace.resolve(relative || ".");
      const entries: FileEntry[] = [];
      for await (const entry of Deno.readDir(full)) {
        if (ignore.has(entry.name)) continue;
        if (count >= treeLimit) break;
        count += 1;
        const id = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory) {
          entries.push({
            id,
            name: entry.name,
            kind: "directory",
            children: await walk(id),
          });
        } else if (entry.isFile) {
          entries.push({ id, name: entry.name, kind: "file" });
        }
      }
      return entries.sort((left, right) => {
        if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
        return left.name.localeCompare(right.name);
      });
    };
    return walk(path === "." ? "" : path);
  }
}
