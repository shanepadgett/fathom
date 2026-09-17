import { join } from "node:path";
import process from "node:process";

import { atomicWrite, readJson } from "./files.ts";

const OWNER = ".fathom-cache-owner.json";
const KIND = "fathom-plugin-cache-v1";
const GENERATION = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

function exited(pid: number) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
}

/** Never infer ownership from age or delete a live peer's module graph. */
export async function prunePluginCache(root: string) {
  try {
    for await (const entry of Deno.readDir(root)) {
      if (!entry.isDirectory || entry.isSymlink || !GENERATION.test(entry.name)) continue;
      const directory = join(root, entry.name);
      try {
        const owner = await readJson<unknown>(join(directory, OWNER), undefined);
        if (!owner || typeof owner !== "object") continue;
        const { kind, pid } = owner as { kind?: unknown; pid?: unknown };
        if (
          kind !== KIND ||
          typeof pid !== "number" ||
          !Number.isSafeInteger(pid) ||
          pid <= 0 ||
          !exited(pid)
        )
          continue;
        await Deno.remove(directory, { recursive: true });
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
          console.error("Could not prune abandoned plugin cache", error);
        }
      }
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.error("Could not scan plugin cache", error);
    }
  }
}

export async function createPluginCache(root: string) {
  const directory = join(root, crypto.randomUUID());
  await atomicWrite(join(directory, OWNER), JSON.stringify({ kind: KIND, pid: Deno.pid }));
  return directory;
}
