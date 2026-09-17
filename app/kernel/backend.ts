import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build, transformWithOxc } from "vite";

import { pluginBuildError } from "./build-error.ts";

/** Compile local helpers into a fresh module graph while sharing host packages. */
export async function compileBackend(entry: string, directory: string) {
  await build({
    configFile: false,
    root: dirname(entry),
    publicDir: false,
    logLevel: "error",
    plugins: [
      {
        name: "fathom-backend-source-location",
        enforce: "pre",
        async transform(code, id) {
          if (!isAbsolute(id) || !/\.[cm]?[jt]sx?$/.test(id)) return;
          return await transformWithOxc(code, id, {
            define: {
              "import.meta.url": JSON.stringify(pathToFileURL(id).href),
              "import.meta.dirname": JSON.stringify(dirname(id)),
              "import.meta.filename": JSON.stringify(id),
            },
          });
        },
        resolveId(source) {
          if (source.startsWith("file:")) return fileURLToPath(source);
        },
      },
    ],
    build: {
      ssr: entry,
      outDir: directory,
      emptyOutDir: true,
      target: "esnext",
      minify: false,
      sourcemap: "inline",
      rolldownOptions: {
        external: (id) => !id.startsWith(".") && !isAbsolute(id) && !id.startsWith("file:"),
        output: {
          entryFileNames: "plugin.mjs",
          chunkFileNames: "[name]-[hash].mjs",
        },
      },
    },
  }).catch((error) => {
    throw pluginBuildError(error);
  });
  return join(directory, "plugin.mjs");
}
