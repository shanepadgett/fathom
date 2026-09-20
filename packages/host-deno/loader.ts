import type { Loader } from "@fathom/kernel";
import { decode, PluginConfigSchema, type PluginDef } from "@fathom/sdk";
import { dirname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

/** Load a fresh source copy so reloads also invalidate nested local modules. */
export class DenoLoader implements Loader {
  private targets = new WeakMap<PluginDef, string>();

  constructor(private home: string) {}

  async load(source: string, gen: number): Promise<{ default: PluginDef }> {
    const root = dirname(source);

    const manifest = decode(
      PluginConfigSchema,
      JSON.parse(await Deno.readTextFile(source)),
    ).fathom;

    if (!manifest.backend) {
      throw new Error("Plugin configuration has no backend entry");
    }

    if (manifest.sdk !== "^0.1") {
      throw new Error(`Unsupported SDK range ${manifest.sdk}`);
    }

    const entry = resolve(root, manifest.backend);

    if (!entry.startsWith(root + sep)) {
      throw new Error("Entry escapes plugin directory");
    }

    const target = `${this.home}/artifacts/${manifest.id}/${gen}-${crypto.randomUUID()}`;
    await Deno.mkdir(target, { recursive: true });

    async function copy(from: string, to: string) {
      for await (const item of Deno.readDir(from)) {
        if (["node_modules", ".git", "dist"].includes(item.name)) {
          continue;
        }

        if (item.isSymlink) {
          throw new Error("Plugin source symlinks are unsupported");
        }

        const src = `${from}/${item.name}`;
        const dest = `${to}/${item.name}`;

        if (item.isDirectory) {
          await Deno.mkdir(dest);
          await copy(src, dest);
        } else if (item.isFile) {
          await Deno.copyFile(src, dest);
        }
      }
    }

    try {
      await copy(root, target);

      const loaded = await import(
        pathToFileURL(resolve(target, manifest.backend)).href
      );

      if (loaded.default?.id !== manifest.id) {
        throw new Error("Configured and exported plugin ids differ");
      }

      this.targets.set(loaded.default, target);

      return loaded;
    } catch (error) {
      await Deno.remove(target, { recursive: true });
      throw error;
    }
  }

  async retain(definitions: PluginDef[]) {
    const keep = new Set(definitions.map((def) => this.targets.get(def)));
    await Deno.mkdir(`${this.home}/artifacts`, { recursive: true });

    for await (const plugin of Deno.readDir(`${this.home}/artifacts`)) {
      if (!plugin.isDirectory) {
        continue;
      }

      const directory = `${this.home}/artifacts/${plugin.name}`;

      if (![...keep].some((path) => path?.startsWith(directory + "/"))) {
        await Deno.remove(directory, { recursive: true });
        continue;
      }

      for await (const generation of Deno.readDir(directory)) {
        const path = `${this.home}/artifacts/${plugin.name}/${generation.name}`;

        if (generation.isDirectory && !keep.has(path)) {
          await Deno.remove(path, { recursive: true });
        }
      }
    }
  }
}
