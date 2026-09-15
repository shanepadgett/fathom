import type { Project, Session } from "../../sdk/session.ts";
import type { createWorkspace } from "../state/workspace.ts";

import { createSignal, onCleanup, onMount, Show } from "solid-js";

import { Icon } from "./icon.tsx";
import { SearchDialog } from "./search-dialog.tsx";
import { SearchList } from "./search-list.tsx";

export function SessionPicker(
  props: {
    app: ReturnType<typeof createWorkspace>;
    kind: "new" | "search";
    close(): void;
  },
) {
  const app = props.app;
  const [sessions, setSessions] = createSignal<
    { project: Project; session: Session }[]
  >([]);
  const [loading, setLoading] = createSignal(props.kind === "search");
  const [failure, setFailure] = createSignal("");
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  onMount(async () => {
    if (props.kind !== "search") return;
    try {
      const result = await app.transport.request<
        {
          items: { project: Project; session: Session }[];
          unavailable: string[];
        }
      >("sessions.catalog");
      if (disposed) return;
      setSessions(result.items);
      if (result.unavailable.length) {
        setFailure(
          `Could not read sessions in: ${result.unavailable.join(", ")}`,
        );
      }
    } catch (error) {
      if (!disposed) {
        setFailure(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (!disposed) setLoading(false);
    }
  });
  return (
    <SearchDialog
      label={props.kind === "new" ? "New session" : "Search sessions"}
      close={props.close}
    >
      <Show
        when={props.kind === "new"}
        fallback={
          <>
            <Show when={failure()}>
              <p role="alert" class="px-5 py-3 text-sm text-danger">
                {failure()}
              </p>
            </Show>
            <SearchList
              items={sessions()}
              label="Search sessions"
              placeholder="Search sessions…"
              heading="Recent sessions"
              scope="All projects"
              action="Open session"
              empty={loading() ? "Loading sessions…" : "No sessions found"}
              searchText={({ session, project }) =>
                `${session.title} ${project.name}`}
              select={async ({ session, project }) => {
                if (app.project()?.id !== project.id) {
                  await app.openProject(
                    project.path,
                  );
                }
                await app.chooseSession(session.id);
                props.close();
              }}
            >
              {({ session, project }) => (
                <>
                  <span class="text-muted">
                    <Icon name="chat-circle-text" size="large" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm">{session.title}</span>
                    <span class="mt-1 block text-xs text-muted">
                      {project.name}
                    </span>
                  </span>
                  <span class="shrink-0 text-xs text-muted">
                    {new Date(session.updatedAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </>
              )}
            </SearchList>
          </>
        }
      >
        <SearchList
          items={app.projects()}
          label="Search projects"
          placeholder="Search projects…"
          heading="New session · Choose a project"
          action="Start session"
          empty="Open a project to start a session."
          searchText={(project) => `${project.name} ${project.path}`}
          select={async (project) => {
            if (app.project()?.id !== project.id) {
              await app.openProject(
                project.path,
              );
            }
            await app.newSession();
            props.close();
          }}
        >
          {(project) => (
            <>
              <span class="text-muted">
                <Icon name="folder" size="large" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm">{project.name}</span>
                <span class="mt-1 block truncate text-xs text-muted">
                  {project.path}
                </span>
              </span>
            </>
          )}
        </SearchList>
      </Show>
    </SearchDialog>
  );
}
