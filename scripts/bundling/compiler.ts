import * as esbuild from "esbuild";
import { UI_RUNTIME_IMPORTS } from "@fathom/sdk";
import { solidTransform } from "./solid-transform.ts";
import { workspaceImports } from "./workspace-imports.ts";

export function buildBrowser(
  entry: string,
  options: {
    directory: string;
    external?: string[];
    alias?: Record<string, string>;
    resolveWorkspace?: boolean;
  },
): Promise<esbuild.BuildResult<{ write: false; metafile: true }>> {
  return esbuild.build({
    absWorkingDir: options.directory,
    entryPoints: [entry],
    bundle: true,
    write: false,
    outdir: "out",
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["browser"],
    external: options.external ?? UI_RUNTIME_IMPORTS,
    alias: options.alias,
    plugins: options.resolveWorkspace
      ? [workspaceImports, solidTransform]
      : [solidTransform],
    metafile: true,
    logLevel: "warning",
  });
}
