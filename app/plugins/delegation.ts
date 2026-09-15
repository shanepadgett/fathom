import { Type } from "typebox";

import { definePlugin } from "../sdk/mod.ts";

export default definePlugin({
  id: "fathom:delegation",
  apiVersion: 1,
  backend: {
    requires: ["storage", "runtime", "tools"],
    activate(ctx) {
      const storage = ctx.get("storage"),
        runtime = ctx.get("runtime"),
        tools = ctx.get("tools");
      const dispose = tools.register({
        name: "consult_expert",
        description:
          "Consult an expert in a persistent child session. Pass consultation_id for follow-up questions. Returns a concise answer; the child transcript remains inspectable.",
        deferred: true,
        parameters: Type.Object({
          question: Type.String(),
          consultation_id: Type.Optional(Type.String()),
        }),
        async execute(args, input) {
          const parent = storage.getSession(input.sessionId);
          const child = args.consultation_id
            ? storage.getSession(String(args.consultation_id))
            : storage.createSession({
              title: `Expert · ${String(args.question).slice(0, 60)}`,
              parentSessionId: parent.id,
              provider: storage.setting("expertProvider", "") ||
                parent.provider,
              model: storage.setting("expertModel", "") || parent.model,
              thinking: "high",
            });
          if (child.parentSessionId !== parent.id) {
            throw new Error("Consultation belongs to another session");
          }
          storage.updateSession(child.id, { toolPolicy: "read-only" });
          const abort = () => runtime.abort(child.id);
          input.signal.addEventListener("abort", abort, { once: true });
          try {
            await runtime.submit(child.id, String(args.question));
            await runtime.whenIdle(child.id);
            input.signal.throwIfAborted();
            const message = storage.entries(child.id).filter((entry) =>
              entry.message?.role === "assistant"
            ).at(-1)?.message;
            const answer = message && typeof message.content !== "string"
              ? message.content.filter((block) => block.type === "text").map(
                (block) => block.text,
              ).join("\n")
              : "Expert did not return a final answer. Inspect its session for details.";
            return JSON.stringify({
              consultation_id: child.id,
              answer,
              status: storage.getSession(child.id).status,
            });
          } finally {
            input.signal.removeEventListener("abort", abort);
          }
        },
      });
      ctx.effect(() => dispose);
    },
  },
});
