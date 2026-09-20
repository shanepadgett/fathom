import { decode } from "../schema.ts";
import { PluginConfigSchema } from "../plugin-config.ts";
import { resolve } from "node:path";
import { buildBrowser } from "./compiler.ts";

/** Compile a plugin's configured UI entry, keeping host runtimes external. */
export async function bundleUi(
  pluginDir: string,
): Promise<{ js: Uint8Array; css: string }> {
  const dir = resolve(pluginDir);

  const manifest = decode(
    PluginConfigSchema,
    JSON.parse(await Deno.readTextFile(resolve(dir, "deno.json"))),
  ).fathom;

  if (!manifest.ui) {
    throw new Error("Plugin configuration has no UI entry");
  }

  const result = await buildBrowser(resolve(dir, manifest.ui), {
    directory: dir,
    resolveWorkspace: true,
  });

  if (
    Object.keys(result.metafile.inputs).some((path) =>
      /node_modules\/.*solid-js\//.test(path),
    )
  ) {
    throw new Error("Plugin bundled a second Solid runtime");
  }

  const js = result.outputFiles.find((file) => file.path.endsWith(".js"));

  if (!js) {
    throw new Error("UI build produced no JavaScript output");
  }

  return {
    js: js.contents,
    css: [
      ...result.outputFiles
        .filter((f) => f.path.endsWith(".css"))
        .map((f) => f.text),
      ...(await Promise.all(
        (manifest.styles ?? []).map((path) =>
          Deno.readTextFile(resolve(dir, path)),
        ),
      )),
    ].join("\n"),
  };
}
