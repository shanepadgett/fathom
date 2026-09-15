import type { Project } from "../sdk/mod.ts";

import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { definePlugin } from "../sdk/mod.ts";

function contains(root: string, path: string) {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith("../");
}

export function workspacePlugin(project: Project, home: string) {
  return definePlugin({
    id: "fathom:workspace",
    apiVersion: 1,
    backend: {
      provides: ["workspace"],
      activate(ctx) {
        const dataDir = join(home, "projects", project.id);
        const readable = [
          project.path,
          join(home, "skills"),
          join(home, "references"),
          join(home, "artifacts"),
          join(home, "types"),
          join(dataDir, "scratch"),
        ];
        ctx.provide("workspace", {
          id: project.id,
          root: project.path,
          dataDir,
          trusted: () => project.trusted,
          async resolve(path, write = false) {
            const target = resolve(project.path, path);
            const roots = write ? [project.path] : readable;
            const canonicalRoots = await Promise.all(roots.map(async (root) => {
              try {
                return await Deno.realPath(root);
              } catch (error) {
                if (!(error instanceof Deno.errors.NotFound)) throw error;
                return root;
              }
            }));
            if (
              ![...roots, ...canonicalRoots].some((root) =>
                contains(root, target)
              )
            ) {
              throw new Error("Path is outside the authorized workspace");
            }
            let existing = target;
            for (;;) {
              try {
                const real = await Deno.realPath(existing);
                if (!canonicalRoots.some((root) => contains(root, real))) {
                  throw new Error(
                    "Symlink points outside the authorized workspace",
                  );
                }
                break;
              } catch (error) {
                if (
                  !(error instanceof Deno.errors.NotFound) || !write
                ) throw error;
                const parent = dirname(existing);
                if (parent === existing) throw error;
                existing = parent;
              }
            }
            return target;
          },
        });
      },
    },
  });
}
