import type { createWorkspace } from "../state/workspace.ts";

import { createSignal } from "solid-js";

import { SearchDialog } from "./search-dialog.tsx";
import { SearchList } from "./search-list.tsx";

export function ArchivedSessions(props: { app: ReturnType<typeof createWorkspace> }) {
  const app = props.app;
  const projectId = app.project()?.id;
  const [restoring, setRestoring] = createSignal<string>();
  const sessions = () =>
    app.project()?.id === projectId ? app.sessions().filter((session) => session.archived) : [];

  async function restore(id: string) {
    if (restoring()) return;
    if (!projectId || app.project()?.id !== projectId) {
      throw new Error("The project changed. Reopen archived sessions for the current project.");
    }
    setRestoring(id);
    try {
      await app.transport.request("session.update", {
        projectId,
        sessionId: id,
        changes: { archived: false },
      });
      if (app.project()?.id !== projectId) return;
      await app.chooseSession(id);
      app.setArchivedOpen(false);
    } finally {
      setRestoring(undefined);
    }
  }

  return (
    <SearchDialog
      label="Archived sessions"
      close={() => {
        if (!restoring()) app.setArchivedOpen(false);
      }}
    >
      <SearchList
        items={sessions()}
        label="Find an archived session"
        heading="Archived sessions"
        action="Restore session"
        placeholder="Search by title"
        empty="No archived sessions match."
        disabled={!!restoring()}
        searchText={(session) => session.title}
        select={(session) => restore(session.id)}
      >
        {(session) => (
          <>
            <span class="min-w-0">
              <span class="block truncate font-medium" title={session.title}>
                {session.title}
              </span>
              <span class="block text-sm text-muted">
                {new Date(session.updatedAt).toLocaleDateString()}
              </span>
            </span>
            <span class="shrink-0">{restoring() === session.id ? "Restoring…" : "Restore"}</span>
          </>
        )}
      </SearchList>
    </SearchDialog>
  );
}
