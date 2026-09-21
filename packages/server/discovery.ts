import { join } from "node:path";
import { decode, PluginConfigSchema, T, type Static } from "@fathom/sdk";

export async function discover(
  resources: string,
  home: string,
): Promise<
  { source: string; manifest: Static<typeof PluginConfigSchema>["fathom"] }[]
> {
  const sources: string[] = [];

  for await (const dir of Deno.readDir(join(resources, "plugins"))) {
    if (dir.isDirectory) {
      sources.push(join(resources, "plugins", dir.name, "deno.json"));
    }
  }

  try {
    const installed = decode(
      T.Array(T.String()),
      JSON.parse(await Deno.readTextFile(join(home, "plugins.json"))),
    );

    sources.push(...installed);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      throw e;
    }
  }

  const manifests = [];
  const ids = new Set<string>();

  for (const source of sources) {
    const manifest = decode(
      PluginConfigSchema,
      JSON.parse(await Deno.readTextFile(source)),
    ).fathom;

    if (ids.has(manifest.id)) {
      throw new Error(`Duplicate plugin ${manifest.id}`);
    }

    ids.add(manifest.id);
    manifests.push({ source, manifest });
  }

  return manifests;
}
