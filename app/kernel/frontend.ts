import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { build } from "vite";
import solid from "vite-plugin-solid";

import { pluginBuildError } from "./build-error.ts";

const require = createRequire(import.meta.url);

/** Frontend code is compiled by the host; plugin authors can write plain TS or TSX. */
export async function compileFrontend(entry: string, directory: string) {
  await mkdir(directory, { recursive: true });
  const solidRoot = dirname(require.resolve("solid-js/package.json"));
  await build({
    configFile: false,
    root: dirname(entry),
    publicDir: false,
    logLevel: "error",
    plugins: [solid()],
    resolve: {
      alias: [
        { find: /^solid-js$/, replacement: join(solidRoot, "dist/solid.js") },
        {
          find: /^solid-js\/web$/,
          replacement: join(solidRoot, "web/dist/web.js"),
        },
        {
          find: /^solid-js\/store$/,
          replacement: join(solidRoot, "store/dist/store.js"),
        },
      ],
    },
    build: {
      outDir: directory,
      emptyOutDir: true,
      target: "esnext",
      lib: {
        entry,
        formats: ["es"],
        fileName: () => "plugin.js",
        cssFileName: "plugin",
      },
    },
  }).catch((error) => {
    throw pluginBuildError(error);
  });
  return join(directory, "plugin.js");
}
