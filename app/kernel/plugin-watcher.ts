import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function contains(directory: string, path: string) {
  const child = relative(directory, path);
  return child === "" ||
    (child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child));
}

export async function watchPlugins(
  paths: { roots: string[]; directories: string[] },
  changed: () => void,
  failed: () => void,
) {
  const watchers: Deno.FsWatcher[] = [];
  let disposed = false;
  async function listen(
    watcher: Deno.FsWatcher,
    relevant: (path: string) => boolean,
  ) {
    try {
      for await (const event of watcher) {
        if (event.kind !== "access" && event.paths.some(relevant)) changed();
      }
    } catch {
      if (!disposed) failed();
    }
  }
  try {
    for (const root of new Set(paths.roots)) {
      const canonical = await Deno.realPath(root);
      const configs = new Set([
        resolve(canonical, "deno.json"),
        resolve(canonical, "deno.jsonc"),
      ]);
      const watcher = Deno.watchFs(canonical, { recursive: false });
      watchers.push(watcher);
      void listen(watcher, (path) => configs.has(resolve(path)));
    }
    for (const directory of new Set(paths.directories)) {
      let parent = directory;
      while (true) {
        try {
          await Deno.stat(parent);
          break;
        } catch (error) {
          if (
            !(error instanceof Deno.errors.NotFound) ||
            dirname(parent) === parent
          ) throw error;
          parent = dirname(parent);
        }
      }
      const canonical = await Deno.realPath(parent);
      const target = resolve(canonical, relative(parent, directory));
      const watcher = Deno.watchFs(canonical, { recursive: true });
      watchers.push(watcher);
      void listen(
        watcher,
        (path) =>
          contains(target, resolve(path)) || contains(resolve(path), target),
      );
    }
  } catch (error) {
    disposed = true;
    for (const watcher of watchers) watcher.close();
    throw error;
  }
  return () => {
    disposed = true;
    for (const watcher of watchers) watcher.close();
  };
}
