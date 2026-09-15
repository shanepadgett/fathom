import { join } from "node:path";

// @deno-types="@types/proper-lockfile"
import lockfile from "proper-lockfile";

import { atomicWrite } from "../kernel/files.ts";
import { definePlugin } from "../sdk/mod.ts";

function waitForSnapshot<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    // Keep observing the work after cancellation: it still owns its queue slot
    // and must finish releasing any acquired lock before another writer runs.
    work.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
    if (signal.aborted) abort();
  });
}

async function withSnapshotLock<T>(
  dataDir: string,
  operation: (signal: AbortSignal) => Promise<T>,
  lifetime: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, lifetime]);
  signal.throwIfAborted();
  const release = await lockfile.lock(dataDir, {
    lockfilePath: join(dataDir, "snapshots.lock"),
    stale: 30_000,
    update: 10_000,
    retries: { retries: 10, minTimeout: 100, maxTimeout: 1000 },
    onCompromised: (error) => controller.abort(error),
  }).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ELOCKED") {
      throw new Error(
        "Another process is using workspace snapshots. Try again shortly.",
        { cause: error },
      );
    }
    throw error;
  });
  try {
    signal.throwIfAborted();
    const result = await operation(signal);
    signal.throwIfAborted();
    return result;
  } finally {
    try {
      await release();
    } finally {
      // A compromised lock's release rejects too; preserve the ownership error.
      signal.throwIfAborted();
    }
  }
}

export default definePlugin({
  id: "fathom:snapshots",
  apiVersion: 1,
  backend: {
    requires: ["workspace", "rpc"],
    provides: ["snapshots"],
    async activate(ctx) {
      const lifetime = new AbortController();
      ctx.effect(() => () => lifetime.abort(new Error("Project closed")));
      const workspace = ctx.get("workspace");
      await Deno.mkdir(workspace.dataDir, { recursive: true });
      const dataDir = await Deno.realPath(workspace.dataDir);
      const gitDir = join(dataDir, "shadow.git");
      const retain = async (signal: AbortSignal, tree: string) => {
        // Record reuse before releasing the lock, including the admission-to-SQLite gap.
        await atomicWrite(
          join(gitDir, "fathom-retention", tree),
          String(Date.now()),
          0o600,
          signal,
        );
        signal.throwIfAborted();
      };
      const command = async (signal: AbortSignal, args: string[]) => {
        signal.throwIfAborted();
        try {
          return await new Deno.Command("git", {
            args,
            cwd: workspace.root,
            stdout: "piped",
            stderr: "piped",
            signal,
          }).output();
        } finally {
          signal.throwIfAborted();
        }
      };
      const git = async (signal: AbortSignal, ...args: string[]) => {
        const result = await command(signal, [
          `--git-dir=${gitDir}`,
          `--work-tree=${workspace.root}`,
          ...args,
        ]);
        if (!result.success) {
          throw new Error(new TextDecoder().decode(result.stderr));
        }
        return new TextDecoder().decode(result.stdout).trim();
      };
      let lock = Promise.resolve();
      const serialize = <T>(
        action: (signal: AbortSignal) => Promise<T>,
        requested?: AbortSignal,
      ) => {
        const signal = requested
          ? AbortSignal.any([lifetime.signal, requested])
          : lifetime.signal;
        const next = lock.then(() =>
          withSnapshotLock(
            dataDir,
            action,
            signal,
          )
        );
        lock = next.then(() => {}, () => {});
        return waitForSnapshot(next, signal);
      };
      const planPrune = async (signal: AbortSignal) => {
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const refs = await git(
          signal,
          "for-each-ref",
          "--format=%(refname) %(objectname)",
          "refs/snapshots/",
        );
        const trees: string[] = [];
        let retained = 0;
        for (const ref of refs.split("\n").filter(Boolean)) {
          signal.throwIfAborted();
          const match = /^refs\/snapshots\/([a-f0-9]{40,64}) \1$/.exec(ref);
          if (!match) {
            retained++;
            continue;
          }
          const tree = match[1];
          let used: number;
          try {
            used = Number(
              await Deno.readTextFile(join(gitDir, "fathom-retention", tree)),
            );
          } catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) throw error;
            // Legacy snapshots receive a full retention period when first inspected.
            await retain(signal, tree);
            retained++;
            continue;
          }
          if (Number.isSafeInteger(used) && used > 0 && used < cutoff) {
            trees.push(tree);
          } else retained++;
        }
        return { trees, retained, cutoff };
      };
      await serialize(async (signal) => {
        const init = await command(signal, ["init", "--bare", gitDir]);
        if (!init.success) {
          throw new Error("Git is required for workspace snapshots");
        }
        signal.throwIfAborted();
        await Deno.writeTextFile(
          join(gitDir, "info/exclude"),
          ".git/\n.fathom/\nnode_modules/\n.DS_Store\ndist/\n.cache/\n",
          { signal },
        );
        signal.throwIfAborted();
      });
      const service = {
        changedSince: (tree: string, requested?: AbortSignal) =>
          serialize(async (signal) => {
            if (typeof tree !== "string" || !/^[a-f0-9]{40,64}$/.test(tree)) {
              throw new Error("Invalid snapshot");
            }
            await git(signal, "cat-file", "-e", `${tree}^{tree}`);
            await git(signal, "add", "--all", "--", ".");
            const result = await command(signal, [
              `--git-dir=${gitDir}`,
              `--work-tree=${workspace.root}`,
              "diff",
              "--cached",
              "--name-only",
              "--no-renames",
              "--diff-filter=ACMRT",
              "-z",
              tree,
              "--",
            ]);
            if (!result.success) {
              throw new Error("Could not inspect snapshot changes");
            }
            // NUL-delimited output preserves spaces and newlines in file names.
            return new TextDecoder().decode(result.stdout).split("\0").filter(
              Boolean,
            );
          }, requested),
        planPrune: () => serialize(planPrune),
        prune: (requested: string[]) =>
          serialize(async (signal) => {
            if (
              !Array.isArray(requested) ||
              requested.some((tree) =>
                typeof tree !== "string" || !/^[a-f0-9]{40,64}$/.test(tree)
              )
            ) {
              throw new Error("Invalid snapshot cleanup selection");
            }
            const selected = new Set(requested);
            const plan = await planPrune(signal);
            let removed = 0;
            for (const tree of plan.trees) {
              if (!selected.has(tree)) continue;
              await git(
                signal,
                "update-ref",
                "-d",
                `refs/snapshots/${tree}`,
                tree,
              );
              removed++;
            }
            // Hold ownership through collection, including retries after a prior GC failure.
            await git(signal, "gc", "--no-detach", "--prune=now");
            return { removed };
          }),
        capture: () =>
          serialize(async (signal) => {
            await git(signal, "add", "--all", "--", ".");
            const tree = await git(signal, "write-tree");
            await git(signal, "update-ref", `refs/snapshots/${tree}`, tree);
            await retain(signal, tree);
            return tree;
          }),
        restore: (tree: string) =>
          serialize(async (signal) => {
            if (!/^[a-f0-9]{40,64}$/.test(tree)) {
              throw new Error("Invalid snapshot");
            }
            await git(signal, "cat-file", "-e", `${tree}^{tree}`);
            await git(signal, "add", "--all", "--", ".");
            const backup = await git(signal, "write-tree");
            await git(signal, "update-ref", `refs/snapshots/${backup}`, backup);
            await retain(signal, backup);
            await retain(signal, tree);
            await git(signal, "read-tree", "--reset", "-u", tree);
          }),
        exists: (tree: string) =>
          serialize(async (signal) => {
            if (!/^[a-f0-9]{40,64}$/.test(tree)) return false;
            const result = await command(signal, [
              `--git-dir=${gitDir}`,
              `--work-tree=${workspace.root}`,
              "cat-file",
              "-e",
              `${tree}^{tree}`,
            ]);
            return result.success;
          }),
      };
      ctx.provide("snapshots", service);
      const rpc = ctx.get("rpc");
      const unregister = [
        rpc.register("snapshots.planPrune", () => service.planPrune()),
        rpc.register(
          "snapshots.prune",
          (params) => service.prune(params.trees as string[]),
        ),
      ];
      ctx.cordis.on("run:admit", async (input) => {
        input.snapshotTreeId = await service.capture();
      });
      ctx.effect(() => () => unregister.forEach((dispose) => dispose()));
    },
  },
});
