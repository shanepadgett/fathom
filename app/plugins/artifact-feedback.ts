import type { Artifact } from "../sdk/artifacts.ts";
import type { ArtifactFeedback } from "../sdk/artifact-feedback.ts";
import type { PluginContext } from "../sdk/mod.ts";

import { submittedFeedbackIds } from "./submitted-feedback.ts";

function feedbackText(params: Record<string, unknown>) {
  if (
    typeof params.comment !== "string" || !params.comment.trim() ||
    params.comment.length > 4000 || typeof params.quote !== "string" ||
    params.quote.length > 4000
  ) {
    throw new Error(
      "Add a comment and keep each passage and comment under 4,000 characters",
    );
  }
  return { quote: params.quote, comment: params.comment.trim() };
}

export function registerArtifactFeedback(
  ctx: PluginContext,
  get: (sessionId: string, id: string) => Artifact,
) {
  const storage = ctx.get("storage"),
    runtime = ctx.get("runtime"),
    rpc = ctx.get("rpc");
  const feedback = ctx.get("feedback");
  const key = (sessionId: string) => `artifact.feedback:${sessionId}`;
  const list = (sessionId: string) => {
    const state = runtime.state(sessionId);
    const delivered = submittedFeedbackIds(state, "artifact-feedback");
    const stored = storage.setting<ArtifactFeedback[]>(key(sessionId), []);
    const draft = stored.filter((item) => !delivered.has(item.id));
    if (draft.length !== stored.length) {
      storage.setSetting(key(sessionId), draft);
    }
    return draft;
  };
  const emit = (sessionId: string) =>
    ctx.get("events").publish({ type: "session", sessionId });
  const disposers = [
    rpc.register(
      "artifact.feedback.list",
      (params) => list(String(params.sessionId)),
    ),
    rpc.register("artifact.feedback.stage", (params) => {
      const sessionId = String(params.sessionId);
      const artifact = get(sessionId, String(params.artifactId));
      const text = feedbackText(params);
      return storage.transaction(() => {
        const draft = list(sessionId);
        if (draft.length >= 20) {
          throw new Error(
            "Send or remove feedback before staging more than 20 comments",
          );
        }
        const item: ArtifactFeedback = {
          id: crypto.randomUUID(),
          artifactId: artifact.id,
          name: artifact.name,
          ...text,
        };
        storage.setSetting(key(sessionId), [...draft, item]);
        emit(sessionId);
        return item;
      });
    }),
    rpc.register("artifact.feedback.update", (params) => {
      const sessionId = String(params.sessionId);
      if (feedback.isSubmitting(sessionId)) {
        throw new Error("Wait for feedback submission to finish");
      }
      const text = feedbackText(params);
      return storage.transaction(() => {
        const draft = list(sessionId);
        const previous = draft.find((item) => item.id === params.id);
        if (!previous) throw new Error("This comment is no longer staged");
        get(sessionId, previous.artifactId);
        const updated = { ...previous, ...text };
        storage.setSetting(
          key(sessionId),
          draft.map((item) => item.id === previous.id ? updated : item),
        );
        emit(sessionId);
        return updated;
      });
    }),
    rpc.register("artifact.feedback.remove", (params) => {
      const sessionId = String(params.sessionId);
      if (feedback.isSubmitting(sessionId)) {
        throw new Error("Wait for feedback submission to finish");
      }
      storage.setSetting(
        key(sessionId),
        list(sessionId).filter((item) => item.id !== params.id),
      );
      emit(sessionId);
    }),
    rpc.register(
      "artifact.feedback.send",
      (params) => feedback.send(String(params.sessionId), ["artifacts"]),
    ),
    feedback.register({
      id: "artifacts",
      prepare(sessionId) {
        const draft = list(sessionId);
        for (const item of draft) get(sessionId, item.artifactId);
        const text =
          "Please revise the referenced artifacts using this feedback. Create revisions with the artifact tool's supersedes field; preserve the earlier versions.\n\n" +
          draft.map((item, index) =>
            `${
              index + 1
            }. ${item.name} (artifact ${item.artifactId})\nPassage: ${
              item.quote || "Whole artifact"
            }\nFeedback: ${item.comment}`
          ).join("\n\n");
        return {
          count: draft.length,
          text,
          attachments: [{
            type: "artifact-feedback",
            data: { ids: draft.map((item) => item.id) },
          }],
        };
      },
      reconcile: list,
    }),
  ];
  ctx.effect(() => () => disposers.forEach((dispose) => dispose()));
}
