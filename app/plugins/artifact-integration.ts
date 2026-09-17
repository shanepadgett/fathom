import type { Artifact } from "../sdk/artifacts.ts";

import { Type } from "typebox";

import { definePlugin } from "../sdk/mod.ts";
import { registerArtifactFeedback } from "./artifact-feedback.ts";

/** Stable agent and frontend integration, independent of artifact persistence. */
export const artifactIntegration = definePlugin({
  id: "fathom:artifact-integration",
  apiVersion: 1,
  backend: {
    requires: ["artifacts", "feedback", "tools", "rpc", "context", "storage", "runtime", "events"],
    activate(ctx) {
      const service = ctx.get("artifacts"),
        tools = ctx.get("tools"),
        rpc = ctx.get("rpc"),
        context = ctx.get("context");
      registerArtifactFeedback(ctx, (sessionId, id) => {
        const artifact = service.list(sessionId).find((item) => item.id === id);
        if (!artifact) throw new Error("Artifact not found on this branch");
        return artifact;
      });
      const disposers = [
        tools.register({
          name: "artifact",
          description:
            "Create a plan, document, HTML widget or SVG diagram outside the repository. Use .md for plans and .html for interactive visuals. Set supersedes to the previous artifact ID when revising; earlier versions remain available.",
          deferred: true,
          parameters: Type.Object({
            title: Type.String(),
            name: Type.String(),
            content: Type.String(),
            supersedes: Type.Optional(Type.String()),
          }),
          execute: async (args, input) =>
            JSON.stringify(
              await service.create(input.sessionId, {
                title: args.title === undefined ? undefined : String(args.title),
                name: String(args.name),
                content: String(args.content),
                supersedes: args.supersedes === undefined ? undefined : String(args.supersedes),
              }),
            ),
        }),
        tools.register({
          name: "artifact_read",
          description: "Read an artifact from this conversation branch by ID.",
          deferred: true,
          readOnly: true,
          parameters: Type.Object({ id: Type.String() }),
          execute: async (args, input) =>
            (await service.read(input.sessionId, String(args.id))).content,
        }),
        rpc.register("artifacts.list", (params) => service.list(String(params.sessionId))),
        rpc.register("artifact.read", (params) =>
          service.read(String(params.sessionId), String(params.id)),
        ),
        rpc.register("artifact.materialize", (params) =>
          service.materialize(String(params.sessionId), String(params.id), String(params.path)),
        ),
        rpc.register("artifact.approve", async (params) => {
          await service.approve(String(params.sessionId), String(params.id));
          return {};
        }),
        context.registerProjector("artifact", (data) => {
          const artifact = data as Artifact;
          return {
            role: "user",
            content: `Artifact saved: ${artifact.title}, id=${artifact.id}. Use artifact_read to read it.`,
            timestamp: artifact.createdAt,
          };
        }),
      ];
      ctx.effect(() => () => {
        for (const dispose of disposers) dispose();
      });
    },
  },
});
