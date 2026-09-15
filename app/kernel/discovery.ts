import type { FathomPlugin } from "../sdk/mod.ts";

import { globSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { parse, type ParseError } from "npm:jsonc-parser@3.3.1";

import { compileBackend } from "./backend.ts";

interface Experience {
  fathom?: { plugins?: string[]; disables?: string[] };
}

async function experience(base: string): Promise<Experience> {
  for (const name of ["deno.json", "deno.jsonc"]) {
    try {
      const errors: ParseError[] = [];
      const config = parse(await Deno.readTextFile(join(base, name)), errors, {
        allowTrailingComma: true,
      });
      if (errors.length) throw new Error(`Invalid ${join(base, name)}`);
      return config;
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  return {};
}

export async function discover(
  home: string,
  root: string,
  trusted: boolean,
  generation: number,
  cacheDirectory: string,
) {
  const paths = new Set<string>();
  const disables = new Set<string>();
  const directories = new Set<string>();
  const roots = [home, ...(trusted ? [root] : [])];
  for (const base of roots) {
    const directory = base === home
      ? join(home, "plugins")
      : join(base, ".fathom/plugins");
    await Deno.mkdir(directory, { recursive: true }).catch(() => {});
    directories.add(directory);
    for (const path of globSync("*.{ts,js,mjs}", { cwd: directory })) {
      if (!path.endsWith(".d.ts")) paths.add(resolve(directory, path));
    }
    const config = await experience(base);
    if (config.fathom) {
      const { plugins = [], disables: disabled = [] } = config.fathom;
      if (
        !Array.isArray(plugins) || !Array.isArray(disabled) ||
        ![...plugins, ...disabled].every((value) => typeof value === "string")
      ) throw new Error("Invalid fathom experience configuration");
      for (const id of disabled) disables.add(id);
      for (const pattern of plugins) {
        const prefix = pattern.split(/[*?{\[]/, 1)[0];
        directories.add(
          !prefix
            ? resolve(base)
            : prefix.endsWith("/")
            ? resolve(base, prefix)
            : dirname(resolve(base, prefix)),
        );
        for (const path of globSync(pattern, { cwd: base })) {
          paths.add(resolve(base, path));
        }
      }
    }
  }
  const plugins: FathomPlugin[] = [];
  const assets = new Map<string, string>();
  for (const path of paths) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(path),
    );
    const key = Array.from(
      new Uint8Array(digest),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    const compiled = await compileBackend(
      path,
      join(cacheDirectory, key),
    );
    const url = pathToFileURL(compiled);
    url.searchParams.set("generation", String(generation));
    const manifest = (await import(url.href)).default as FathomPlugin;
    if (
      !manifest || manifest.apiVersion !== 1 || typeof manifest.id !== "string"
    ) throw new Error(`Invalid plugin manifest: ${path}`);
    if (disables.has(manifest.id)) continue;
    plugins.push(manifest);
    if (manifest.frontend) {
      assets.set(
        manifest.id,
        typeof manifest.frontend === "string"
          ? resolve(dirname(path), manifest.frontend)
          : path,
      );
    }
  }
  return {
    plugins,
    assets,
    disables,
    watch: { roots, directories: [...directories] },
  };
}
