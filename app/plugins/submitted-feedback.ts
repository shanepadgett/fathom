import type { SessionState } from "../sdk/session.ts";

export function submittedFeedbackIds(state: SessionState, type: string) {
  return new Set(
    state.entries.flatMap((entry) => entry.attachments ?? [])
      .concat(state.queued.flatMap((entry) => entry.attachments ?? []))
      .filter((attachment) => attachment.type === type)
      .flatMap((attachment) => {
        const ids = (attachment.data as { ids?: unknown })?.ids;
        return Array.isArray(ids)
          ? ids.filter((id): id is string => typeof id === "string")
          : [];
      }),
  );
}
