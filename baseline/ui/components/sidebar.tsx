import type { Session } from "../../types.ts";

import { For, Show } from "solid-js";

export function Sidebar(props: {
  sessions: Session[];
  selected?: string;
  onSelect(id: string): void;
  onCreate(): void;
}) {
  return (
    <session-sidebar>
      <div data-component="session-sidebar">
        <div class="session-sidebar-controls sticky top-0 z-10 flow-root bg-surface">
          <div class="flex h-10 items-center gap-2 px-3">
            <div class="min-w-0 flex-1">
              <ds-button variant="quiet" size="small">
                <button type="button" aria-label="Search chats">
                  <i class="ph ph-magnifying-glass shrink-0 text-base" aria-hidden="true" />
                  Search chats
                </button>
              </ds-button>
            </div>
            <ds-button variant="quiet" size="small" icon-only>
              <button type="button" aria-label="New chat" title="New chat" onClick={props.onCreate}>
                <i class="ph ph-note-pencil shrink-0 text-base" aria-hidden="true" />
              </button>
            </ds-button>
          </div>
        </div>
        <div class="flex flex-col gap-1 px-2">
          <Show
            when={props.sessions.length}
            fallback={<p class="px-3 py-6 text-sm text-muted">No chats yet</p>}
          >
            <For each={props.sessions}>
              {(session) => (
                <button
                  type="button"
                  data-chat-item
                  class={`min-w-0 rounded-control px-2 py-1.5 text-left ${
                    session.id === props.selected ? "bg-action/10" : "hover:bg-canvas"
                  }`}
                  aria-current={session.id === props.selected ? "true" : undefined}
                  onClick={() => props.onSelect(session.id)}
                >
                  <div class="flex min-w-0 items-baseline gap-2">
                    <p
                      class={`min-w-0 flex-1 truncate text-dense ${
                        session.id === props.selected ? "text-action" : "text-ink"
                      }`}
                      title={session.title}
                    >
                      {session.title}
                    </p>
                  </div>
                  <div class="mt-0.5 flex min-w-0 items-center justify-between gap-2 text-micro">
                    <span class="shrink-0 text-muted">{time(session.updatedAt)}</span>
                    <span
                      role="img"
                      aria-label={
                        session.status === "running"
                          ? "Working"
                          : session.status === "error"
                            ? "Error"
                            : "Idle"
                      }
                      title={
                        session.status === "running"
                          ? "Working"
                          : session.status === "error"
                            ? "Error"
                            : "Idle"
                      }
                      class={`ml-auto inline-flex shrink-0 ${
                        session.status === "running"
                          ? "text-action"
                          : session.status === "error"
                            ? "text-danger"
                            : "text-muted"
                      }`}
                    >
                      <span
                        class={`inline-flex ${
                          session.status === "running" ? "motion-safe:animate-session-spin" : ""
                        }`}
                      >
                        <i
                          class={`ph shrink-0 text-xs ${
                            session.status === "running"
                              ? "ph-spinner-gap"
                              : session.status === "error"
                                ? "ph-x"
                                : "ph-moon"
                          }`}
                          aria-hidden="true"
                        />
                      </span>
                    </span>
                  </div>
                </button>
              )}
            </For>
          </Show>
        </div>
      </div>
    </session-sidebar>
  );
}

function time(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
