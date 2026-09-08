import { resolve } from "node:path";

import { definePlugin } from "../kernel/plugin.ts";
export function workspacePlugin(root: string) {
  return definePlugin({
    id: "workspace-local",
    apiVersion: 1,
    provides: ["workspace"],
    async activate(ctx) {
      const path = await Deno.realPath(root);
      if (!(await Deno.stat(path)).isDirectory) {
        throw new Error(`Workspace is not a directory: ${path}`);
      }
      ctx.provide("workspace", {
        root: path,
        resolve: (file) => resolve(path, file),
      });
    },
  });
}
