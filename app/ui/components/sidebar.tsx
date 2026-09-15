import type { Session } from "../../sdk/session.ts";
import type { createWorkspace } from "../state/workspace.ts";

import { For, Show } from "solid-js";

import { Icon } from "./icon.tsx";
import { IconButton } from "./primitives.tsx";
import { PluginSlot } from "./plugin-slot.tsx";

export function Sidebar(props: { app: ReturnType<typeof createWorkspace> }) {
  const app = props.app;
  const visible = () =>
    app.sessions().filter((session) =>
      !session.archived &&
      session.title.toLowerCase().includes(app.search().toLowerCase())
    );
  const list = (items: Session[]) => (
    <div class="flex flex-col gap-1 px-2">
      <For each={items}>
        {(session) => {
          const selected = () => session.id === app.sessionId();
          const running = () =>
            ["running", "retry_waiting"].includes(session.status);
          return (
            <button
              type="button"
              class={`min-w-0 rounded-control px-2 py-2 text-left ${
                selected() ? "bg-action/10" : "hover:bg-canvas"
              }`}
              aria-current={selected() ? "true" : undefined}
              onClick={() => void app.act(() => app.chooseSession(session.id))}
            >
              <Show when={app.mode() !== "chat"}>
                <div class="flex items-center justify-between gap-1.5 text-micro text-muted">
                  <span class="flex min-w-0 items-center gap-1.5">
                    <Icon name="folder" size="small" />
                    <span class="truncate">{app.project()?.name}</span>
                  </span>
                  <span class="shrink-0">
                    {new Date(session.updatedAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </Show>
              <p
                class={`mt-1 truncate text-dense ${
                  selected() ? "text-action" : "text-ink"
                }`}
                title={session.title}
              >
                {session.title}
              </p>
              <div class="mt-1 flex min-w-0 items-center justify-between gap-1.5 text-micro text-muted">
                <Show when={app.mode() === "chat"}>
                  <span>
                    {new Date(session.updatedAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </Show>
                <span
                  class={`ml-auto inline-flex shrink-0 ${
                    running() ? "text-action" : session.status === "error" ||
                        session.status === "approval"
                      ? "text-warning"
                      : "text-muted"
                  }`}
                  role="img"
                  aria-label={session.status}
                  title={session.status}
                >
                  <span
                    class={running()
                      ? "inline-flex motion-safe:animate-session-spin"
                      : "inline-flex"}
                  >
                    <Icon
                      name={running()
                        ? "spinner-gap"
                        : session.status === "error" ||
                            session.status === "approval"
                        ? "chat-circle-text"
                        : "moon"}
                      size="small"
                    />
                  </span>
                </span>
              </div>
            </button>
          );
        }}
      </For>
    </div>
  );
  return (
    <aside
      class="relative flex min-h-0 w-sidebar shrink-0 flex-col border-r border-line bg-surface"
      aria-label="Project sessions"
    >
      <div
        class="min-h-0 flex-1 overflow-y-auto"
        data-component="session-sidebar"
      >
        <div class="sticky top-0 z-10 flow-root bg-surface">
          <div class="flex h-10 items-center gap-2 px-3">
            <div class="flex min-w-0 flex-1 items-center gap-2 text-muted">
              <Icon name="magnifying-glass" />
              <button
                type="button"
                class="h-7 min-w-0 flex-1 text-left text-sm text-muted"
                onClick={() => app.setSessionPicker("search")}
              >
                {app.mode() === "chat" ? "Search chats" : "Search sessions"}
              </button>
            </div>
            <IconButton
              name="note-pencil"
              label="New session"
              onClick={() => app.setSessionPicker("new")}
            />
          </div>
          <Show when={app.mode() !== "chat"}>
            <div class="mx-2 mb-2">
              <button
                type="button"
                class="flex h-8 w-full items-center justify-start gap-2 rounded-control border-0 bg-canvas px-2 py-0 text-sm font-normal"
                onClick={() => app.setProjectDialog(true)}
              >
                <Icon name="folder" />
                <span class="min-w-0 flex-1 truncate text-left">
                  {app.project()?.name ?? "All projects"}
                </span>
                <Icon name="caret-down" />
              </button>
            </div>
          </Show>
        </div>
        <Show when={visible().some((session) => session.pinned)}>
          <section class="mb-4" aria-label="Pinned sessions">
            <h3 class="flex items-center gap-2 px-4 py-2 text-center text-dense font-medium text-ink">
              Pinned sessions
            </h3>
            {list(visible().filter((session) => session.pinned))}
          </section>
          <h3 class="flex items-center gap-2 px-4 py-2 text-center text-dense font-medium text-ink">
            Recent
          </h3>
        </Show>
        {list(visible().filter((session) => !session.pinned))}
        <PluginSlot host={app.uiHost} slot="sidebar" />
      </div>
    </aside>
  );
}
