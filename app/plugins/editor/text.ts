import type { CompletionPosition } from "../../sdk/editor.ts";

export const MAX_EDITOR_BYTES = 4_000_000;

const MAX_CONCURRENT_READS = 4;
const READ_CHUNK_BYTES = 64 * 1024;
const waitingReaders: (() => void)[] = [];

let activeReaders = 0;

/** Shared by RPCs and every service instance, not just one diagnostic batch. */
async function acquireReader(): Promise<() => void> {
  if (activeReaders < MAX_CONCURRENT_READS) activeReaders++;
  else await new Promise<void>((resolve) => waitingReaders.push(resolve));
  return () => {
    const next = waitingReaders.shift();
    if (next) next();
    else activeReaders--;
  };
}

export function editorText(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Editor text must be a string");
  }
  if (
    value.length > MAX_EDITOR_BYTES ||
    new TextEncoder().encode(value).byteLength > MAX_EDITOR_BYTES
  ) {
    throw new Error("File exceeds the editor's 4 MB limit");
  }
  if (value.includes("\0")) {
    throw new Error("Binary file cannot be edited as text");
  }
  return value;
}

export function editorPosition(
  value: unknown,
  text: string,
): CompletionPosition {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid completion position");
  }
  const { line, character } = value as Record<string, unknown>;
  if (
    typeof line !== "number" || !Number.isSafeInteger(line) || line < 0 ||
    typeof character !== "number" || !Number.isSafeInteger(character) ||
    character < 0
  ) {
    throw new Error("Invalid completion position");
  }
  const lines = text.split(/\r\n|\r|\n/);
  if (line >= lines.length || character > lines[line].length) {
    throw new Error("Completion position is outside the text");
  }
  return { line, character };
}

/** The caller must authorize the path before reading. Bound even growing files. */
export async function readEditorText(path: string): Promise<string> {
  const release = await acquireReader();
  let file: Deno.FsFile | undefined;
  try {
    if (!(await Deno.stat(path)).isFile) {
      throw new Error("Editor path must be a regular file");
    }
    file = await Deno.open(path, { read: true });
    const info = await file.stat();
    if (!info.isFile) throw new Error("Editor path must be a regular file");
    if (info.size > MAX_EDITOR_BYTES) {
      throw new Error("File exceeds the editor's 4 MB limit");
    }
    // Small files need only a small buffer. Streaming decode preserves UTF-8
    // characters split between chunks without retaining copies of every byte.
    const bytes = new Uint8Array(
      Math.min(READ_CHUNK_BYTES, Math.max(1024, info.size + 1)),
    );
    const decoder = new TextDecoder();
    const parts: string[] = [];
    let size = 0;
    for (;;) {
      // Read one byte beyond the limit to distinguish exact-size EOF from growth.
      const count = await file.read(
        bytes.subarray(0, Math.min(bytes.length, MAX_EDITOR_BYTES - size + 1)),
      );
      if (count === null) break;
      size += count;
      if (size > MAX_EDITOR_BYTES) {
        throw new Error("File exceeds the editor's 4 MB limit");
      }
      parts.push(decoder.decode(bytes.subarray(0, count), { stream: true }));
    }
    parts.push(decoder.decode());
    return editorText(parts.join(""));
  } finally {
    try {
      file?.close();
    } finally {
      release();
    }
  }
}
