import { defineConfig } from "vite";
import { globSync } from "node:fs";

export default defineConfig({
  publicDir: "ui-public",
  base: "/ui/",
  build: {
    outDir: "ui",
    target: "esnext",
    rolldownOptions: { output: { chunkFileNames: "chunks/[name]-[hash].js" } },
    lib: {
      entry: Object.fromEntries(
        [...globSync("ui-src/**/*.js")].map((
          path,
        ) => [path.slice(7, -3), path]),
      ),
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
    },
  },
});
