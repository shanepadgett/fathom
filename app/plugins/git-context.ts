export interface FileContext {
  path: string;
  text?: string;
  note?: string;
}

/** Read a bounded sample; new files need content as well as names in a plan. */
export async function newFileContext(
  paths: string[],
  resolve: (path: string) => Promise<string>,
): Promise<FileContext[]> {
  const files: FileContext[] = [];
  let remaining = 60_000;
  for (const path of paths) {
    if (!remaining) {
      files.push({
        path,
        note: "Content omitted: total preview limit reached.",
      });
      continue;
    }
    const resolved = await resolve(path);
    const info = await Deno.stat(resolved);
    if (!info.isFile) {
      files.push({ path, note: "Content omitted: not a regular file." });
      continue;
    }
    const limit = Math.min(16_000, remaining);
    using file = await Deno.open(resolved, { read: true });
    const bytes = new Uint8Array(limit);
    let length = 0;
    while (length < limit) {
      const count = await file.read(bytes.subarray(length));
      if (count === null) break;
      length += count;
    }
    remaining -= length;
    const content = bytes.subarray(0, length);
    if (content.includes(0)) {
      files.push({ path, note: "Binary content omitted." });
      continue;
    }
    files.push({
      path,
      text: new TextDecoder().decode(content),
      ...(info.size > length ? { note: "Content truncated to preview limit." } : {}),
    });
  }
  return files;
}
