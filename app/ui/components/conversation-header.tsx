import type { createWorkspace } from "../state/workspace.ts";

import { createSignal, Show } from "solid-js";

import { ActionMenu } from "./action-menu.tsx";
import { RenameSession } from "./rename-session.tsx";
import { DrawerControl } from "./workspace-drawer.tsx";

export function ConversationHeader(props: { app: ReturnType<typeof createWorkspace> }) {
  const { state, detailed, setDetailed, act, transport, sessionId, refresh, newSession } =
    props.app;
  const [renaming, setRenaming] = createSignal<{
    projectId: string;
    sessionId: string;
    title: string;
  }>();
  return (
    <>
      <header
        class="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line"
        classList={{
          "px-6": props.app.mode() !== "editor",
          "pl-6 text-sm": props.app.mode() === "editor",
        }}
      >
        <h2
          class="min-w-0 truncate font-medium"
          classList={{
            "text-base": props.app.mode() !== "editor",
            "text-sm": props.app.mode() === "editor",
          }}
          title={state()?.session.title}
        >
          {state()?.session.title ?? "New session"}
        </h2>
        <Show
          when={props.app.mode() !== "editor"}
          fallback={<DrawerControl kind="agent" close={() => props.app.setAgentDrawer(false)} />}
        >
          <ActionMenu
            label="Conversation options"
            actions={[
              {
                label: detailed() ? "Compact transcript" : "Detailed transcript",
                icon: "chat-circle-text",
                run: () => setDetailed((value) => !value),
              },
              {
                label: state()?.session.pinned ? "Unpin session" : "Pin session",
                icon: "push-pin",
                run: () =>
                  void act(async () => {
                    await transport.request("session.update", {
                      sessionId: sessionId(),
                      changes: { pinned: !state()?.session.pinned },
                    });
                    await refresh();
                  }),
              },
              {
                label: "Rename",
                icon: "note-pencil",
                run: () => {
                  const session = state()?.session;
                  if (session) {
                    setRenaming({
                      projectId: transport.projectId,
                      sessionId: session.id,
                      title: session.title,
                    });
                  }
                },
              },
              {
                label: "Archive",
                icon: "archive",
                run: () =>
                  void act(async () => {
                    const projectId = transport.projectId;
                    const id = sessionId();
                    if (!id) return;
                    await transport.request("session.update", {
                      projectId,
                      sessionId: id,
                      changes: { archived: true },
                    });
                    if (transport.projectId !== projectId || sessionId() !== id) {
                      return;
                    }
                    const next = props.app
                      .sessions()
                      .find((session) => session.id !== id && !session.archived);
                    if (next) await props.app.chooseSession(next.id);
                    else await newSession();
                  }),
              },
              {
                label: "Conversation branches",
                icon: "tree-structure",
                run: () => props.app.setBranchesOpen(true),
              },
              {
                label: "Archived sessions",
                icon: "archive",
                run: () => props.app.setArchivedOpen(true),
              },
            ]}
          />
        </Show>
      </header>
      <Show when={renaming()}>
        {(target) => (
          <RenameSession
            title={target().title}
            close={() => setRenaming(undefined)}
            save={async (title) => {
              await transport.request("session.update", {
                projectId: target().projectId,
                sessionId: target().sessionId,
                changes: { title },
              });
              await refresh();
            }}
          />
        )}
      </Show>
    </>
  );
}
