import { join } from "node:path";

import { assertNewFile, atomicCreate } from "../kernel/files.ts";
import {
  type Artifact,
  type ArtifactInput,
  type ArtifactService,
  artifactsOnBranch,
} from "../sdk/artifacts.ts";
import { definePlugin } from "../sdk/mod.ts";

export function artifactsPlugin(home: string) {
  return definePlugin({
    id: "fathom:artifacts",
    apiVersion: 1,
    backend: {
      requires: [
        "storage",
        "workspace",
        "runtime",
        "events",
      ],
      provides: ["artifacts"],
      activate(ctx) {
        const storage = ctx.get("storage"),
          workspace = ctx.get("workspace"),
          runtime = ctx.get("runtime"),
          events = ctx.get("events");
        const list = (sessionId: string) =>
          artifactsOnBranch(storage.entries(sessionId));
        const get = (sessionId: string, id: string) => {
          const artifact = list(sessionId).find((artifact) =>
            artifact.id === id
          );
          if (!artifact) throw new Error("Artifact not found on this branch");
          return artifact;
        };
        const path = (artifact: Artifact) =>
          join(
            home,
            "artifacts",
            artifact.sessionId,
            `${artifact.id}-${artifact.name}`,
          );
        const create = async (
          sessionId: string,
          input: ArtifactInput,
        ) => {
          storage.getSession(sessionId);
          if (
            !input || typeof input.name !== "string" ||
            !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/.test(input.name)
          ) {
            throw new Error("Use a plain artifact filename");
          }
          if (typeof input.content !== "string") {
            throw new Error("Artifact content must be text");
          }
          const name = input.name, content = input.content;
          const title = input.title === undefined ? name : input.title;
          if (
            typeof title !== "string" || !title.trim() || title.length > 200
          ) {
            throw new Error(
              "Use an artifact title between 1 and 200 characters",
            );
          }
          const bytes = new TextEncoder().encode(content).length;
          if (bytes > 2_000_000) throw new Error("Artifact exceeds 2 MB");
          const supersedes = input.supersedes;
          if (
            supersedes !== undefined &&
            (typeof supersedes !== "string" || !supersedes)
          ) {
            throw new Error("Use an existing artifact ID for supersedes");
          }
          const checkRevision = () => {
            if (
              supersedes && get(sessionId, supersedes).status === "superseded"
            ) {
              throw new Error("Revise the latest artifact version");
            }
          };
          checkRevision();
          const artifact: Artifact = {
            id: crypto.randomUUID(),
            sessionId,
            title: title.trim(),
            name,
            mime: name.endsWith(".html")
              ? "text/html"
              : name.endsWith(".svg")
              ? "image/svg+xml"
              : name.endsWith(".md")
              ? "text/markdown"
              : "text/plain",
            status: "pending",
            supersedes,
            bytes,
            createdAt: Date.now(),
          };
          const destination = path(artifact);
          await atomicCreate(destination, content, 0o600);
          try {
            storage.transaction(() => {
              // Recheck after the async write: another creator may have revised it.
              checkRevision();
              storage.append(sessionId, {
                kind: "custom",
                status: "completed",
                custom: { type: "artifact", data: artifact },
              });
            });
          } catch (error) {
            let recorded: boolean;
            try {
              recorded = storage.allEntries(sessionId).some((entry) =>
                entry.custom?.type === "artifact" &&
                (entry.custom.data as Artifact).id === artifact.id
              );
            } catch (inspection) {
              throw new AggregateError(
                [error, inspection],
                "Artifact persistence could not be confirmed; its cache file was retained",
              );
            }
            if (recorded) throw error;
            try {
              await Deno.remove(destination);
            } catch (cleanup) {
              if (!(cleanup instanceof Deno.errors.NotFound)) {
                throw new AggregateError(
                  [error, cleanup],
                  "Artifact was not saved and its cache file could not be removed",
                );
              }
            }
            throw error;
          }
          events.publish({ type: "session", sessionId });
          return artifact;
        };
        const approvals = new Set<string>();
        const service: ArtifactService = {
          create,
          list,
          async read(sessionId, id) {
            const artifact = get(sessionId, id);
            return {
              ...artifact,
              content: await Deno.readTextFile(path(artifact)),
            };
          },
          async materialize(sessionId, id, destinationPath) {
            const artifact = get(sessionId, id);
            const destination = await workspace.resolve(
              destinationPath,
              true,
            );
            await assertNewFile(destination);
            await atomicCreate(
              destination,
              await Deno.readTextFile(path(artifact)),
              0o644,
            );
            return { path: destination };
          },
          async approve(sessionId, id) {
            const artifact = get(sessionId, id);
            if (artifact.status !== "pending") {
              throw new Error("Choose a pending artifact to approve");
            }
            const key = `${sessionId}:${artifact.id}`;
            if (approvals.has(key)) {
              throw new Error("Artifact approval is already in progress");
            }
            approvals.add(key);
            try {
              await runtime.submit(
                sessionId,
                `I approve the artifact "${artifact.title}" (${artifact.id}). Proceed with the work described in it.`,
                "follow_up",
              );
              storage.append(sessionId, {
                kind: "custom",
                status: "completed",
                custom: {
                  type: "artifact-approval",
                  data: { artifactId: artifact.id, approvedAt: Date.now() },
                },
              });
              events.publish({ type: "session", sessionId });
            } finally {
              approvals.delete(key);
            }
          },
        };
        ctx.provide("artifacts", service);
      },
    },
  });
}
