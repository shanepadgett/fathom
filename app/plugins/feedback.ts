import type { FeedbackService, FeedbackSource } from "../sdk/feedback.ts";

import { definePlugin } from "../sdk/mod.ts";

export const feedback = definePlugin({
  id: "fathom:feedback",
  apiVersion: 1,
  backend: {
    requires: ["runtime", "events"],
    provides: ["feedback"],
    activate(ctx) {
      const sources = new Map<string, FeedbackSource>();
      const sending = new Set<string>();
      const service: FeedbackService = {
        register(source) {
          if (!source.id || sources.has(source.id)) {
            throw new Error("Feedback source ID must be unique");
          }
          sources.set(source.id, source);
          return () => {
            if (sources.get(source.id) === source) sources.delete(source.id);
          };
        },
        isSubmitting: (id) => sending.has(id),
        async send(sessionId, selected) {
          if (sending.has(sessionId)) {
            throw new Error("Feedback is already being submitted");
          }
          const ids = selected ?? [...sources.keys()];
          if (new Set(ids).size !== ids.length) {
            throw new Error("Select each feedback source only once");
          }
          const batch = ids.map((id) => {
            const source = sources.get(id);
            if (!source) {
              throw new Error(`Feedback source is unavailable: ${id}`);
            }
            return source;
          });
          sending.add(sessionId);
          try {
            const prepared = [];
            for (const source of batch) {
              prepared.push(await source.prepare(sessionId));
            }
            const active = prepared.filter((part) => part.count > 0);
            const sent = active.reduce((count, part) => count + part.count, 0);
            if (!sent) throw new Error("Stage at least one comment first");
            await ctx.get("runtime").submit(
              sessionId,
              active.map((part) => part.text).join("\n\n"),
              "follow_up",
              active.flatMap((part) => part.attachments),
            );
            for (const source of batch) await source.reconcile(sessionId);
            ctx.get("events").publish({ type: "session", sessionId });
            return { sent };
          } finally {
            sending.delete(sessionId);
          }
        },
      };
      ctx.provide("feedback", service);
    },
  },
});

export const feedbackIntegration = definePlugin({
  id: "fathom:feedback-integration",
  apiVersion: 1,
  backend: {
    requires: ["feedback", "rpc"],
    activate(ctx) {
      ctx.effect(() =>
        ctx
          .get("rpc")
          .register("feedback.send", (params) =>
            ctx.get("feedback").send(String(params.sessionId)),
          ),
      );
    },
  },
});
