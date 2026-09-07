import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { globSync } from "node:fs";

export default defineConfig({
  plugins: [solid()],
  publicDir: "ui-public",
  base: "/ui/",
  build: {
    outDir: "ui",
    target: "esnext",
    rolldownOptions: { output: { chunkFileNames: "chunks/[name]-[hash].js" } },
    lib: {
      entry: Object.fromEntries(
        [...globSync("ui-src/**/*.{js,jsx}")].map((
          path,
        ) => [path.slice(7).replace(/\.jsx?$/, ""), path]),
      ),
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
    },
  },
});
