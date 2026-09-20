import type * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import { UI_RUNTIME_IMPORTS } from "../ui-artifact.ts";

export const workspaceImports: esbuild.Plugin = {
  name: "workspace-imports",
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, ({ path }) => {
      if (UI_RUNTIME_IMPORTS.includes(path)) {
        return { path, external: true };
      }

      let resolved: string;

      try {
        resolved = import.meta.resolve(path);
      } catch {
        return;
      }

      if (resolved.startsWith("file:")) {
        return { path: fileURLToPath(resolved) };
      }

      // npm dependencies are resolved by esbuild from the active node_modules directory.
      if (!resolved.startsWith("npm:")) {
        throw new Error(
          "UI dependencies must resolve to local or npm sources: " + path,
        );
      }
    });
  },
};
