import type { Transport } from "../transport.ts";

import { createResource, onCleanup } from "solid-js";

/** Keep persisted drafts synchronized across viewers and the composer. */
export function sessionDraft<T>(
  transport: Transport,
  sessionId: () => string,
  method: string,
) {
  const [draft, { refetch }] = createResource(
    () => sessionId() || false,
    (id) => transport.request<T[]>(method, { sessionId: id }),
  );
  onCleanup(transport.onEvent((event) => {
    if (
      event.type === "session" && event.projectId === transport.projectId &&
      event.sessionId === sessionId()
    ) void Promise.resolve(refetch()).catch(() => {});
  }));
  return { draft, refetch };
}
