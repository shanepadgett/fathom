import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

async function writeAtomically(
  path: string,
  content: string | Uint8Array,
  mode: number,
  replace: boolean,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  await Deno.mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await Deno.writeFile(
      temporary,
      typeof content === "string" ? new TextEncoder().encode(content) : content,
      { createNew: true, mode, signal },
    );
    const file = await Deno.open(temporary, { write: true });
    try {
      await file.sync();
    } finally {
      file.close();
    }
    signal?.throwIfAborted();
    if (replace) await Deno.rename(temporary, path);
    else {
      try {
        await Deno.link(temporary, path);
      } catch (error) {
        if (error instanceof Deno.errors.AlreadyExists) {
          throw new Error("Destination already exists; choose a new path", {
            cause: error,
          });
        }
        throw error;
      }
    }
  } finally {
    await Deno.remove(temporary).catch((error) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    });
  }
}

/** Check availability without reserving or creating the destination. */
export async function assertNewFile(path: string): Promise<void> {
  try {
    await Deno.lstat(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return;
    throw error;
  }
  throw new Error("Destination already exists; choose a new path");
}

export function atomicWrite(
  path: string,
  content: string | Uint8Array,
  mode = 0o600,
  signal?: AbortSignal,
) {
  return writeAtomically(path, content, mode, true, signal);
}

/** Publish a fully written file without replacing any existing destination. */
export function atomicCreate(path: string, content: string | Uint8Array, mode = 0o644) {
  return writeAtomically(path, content, mode, false);
}

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await Deno.readTextFile(path));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return fallback;
    throw error;
  }
}
