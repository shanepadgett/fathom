import type { ModelChoice, Session, SessionSnapshot, Surface, SurfaceId } from "../types.ts";

import { Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";

import * as api from "./api.ts";
import { Conversation } from "./components/conversation.tsx";
import { Editor } from "./components/editor.tsx";
import { FocusSwitch } from "./components/focus-switch.tsx";
import { Sidebar } from "./components/sidebar.tsx";

export function App() {
  const [surfaces, setSurfaces] = createSignal<Surface[]>([]);
  const [focus, setFocus] = createSignal<SurfaceId>();
  const [chats, setChats] = createSignal<Session[]>([]);
  const [selected, setSelected] = createSignal<string>();
  const [current, setCurrent] = createSignal<SessionSnapshot>();
  const [choices, setChoices] = createSignal<ModelChoice[]>([]);
  const [sidebarOpen, setSidebarOpen] = createSignal(true);

  async function refresh() {
    setChats(await api.sessions());
  }

  onMount(async () => {
    const [available, list, mounted] = await Promise.all([
      api.models(),
      api.sessions(),
      api.surfaces(),
    ]);
    setChoices(available);
    setSurfaces(mounted);
    setFocus(mounted.find((surface) => surface.id === "agent")?.id ?? mounted[0]?.id);
    if (list.length) {
      setChats(list);
      setSelected(list[0].id);
      return;
    }
    const session = await api.createSession();
    setChats([session]);
    setSelected(session.id);
  });

  createEffect(() => {
    const id = selected();
    if (!id) {
      setCurrent(undefined);
      return;
    }
    const stop = api.follow(id, (state) => {
      setCurrent(state);
      void refresh();
    });
    onCleanup(stop);
  });

  async function create() {
    const session = await api.createSession();
    await refresh();
    setSelected(session.id);
  }

  const talking = () => focus() === "chat" || focus() === "agent";

  return (
    <div data-screen-only class="contents">
      <div class="workspace-shell">
        <workspace-layout>
          <header class="relative flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface pl-4">
            <div class="flex min-w-0 items-center gap-6">
              <span class="whitespace-nowrap font-bold tracking-tight">
                Fathom
                <span class="text-action dark:text-teal-200">.</span>
              </span>
              <ds-button variant="quiet" size="small" icon-only>
                <button
                  type="button"
                  aria-label={sidebarOpen() ? "Close sidebar" : "Open sidebar"}
                  title={sidebarOpen() ? "Close sidebar" : "Open sidebar"}
                  data-sidebar-toggle
                  aria-expanded={sidebarOpen()}
                  onClick={() => setSidebarOpen((open) => !open)}
                >
                  <i class="ph ph-sidebar-simple shrink-0 text-xl" aria-hidden="true" />
                </button>
              </ds-button>
            </div>
            <div class="absolute left-1/2 -translate-x-1/2">
              <FocusSwitch surfaces={surfaces()} mode={focus()} onMode={setFocus} />
            </div>
          </header>
          <div class="workspace-body">
            <Show when={talking()}>
              <>
                <workspace-sidebar
                  placement="chats"
                  role="complementary"
                  aria-label={focus() === "chat" ? "Chats" : "Project sessions"}
                  hidden={!sidebarOpen()}
                >
                  <Sidebar
                    sessions={chats()}
                    selected={selected()}
                    onSelect={setSelected}
                    onCreate={() => void create()}
                  />
                </workspace-sidebar>
                <Conversation
                  mode={focus() === "chat" ? "chat" : "agent"}
                  snapshot={current()}
                  models={choices()}
                  onSend={(text) => {
                    const id = selected();
                    if (id) void api.send(id, text);
                  }}
                  onStop={() => {
                    const id = selected();
                    if (id) void api.stop(id);
                  }}
                  onModel={(choice) => {
                    const id = selected();
                    if (id) void api.chooseModel(id, choice);
                  }}
                />
              </>
            </Show>
            <Show when={focus() === "editor"}>
              <Editor sidebarOpen={sidebarOpen()} />
            </Show>
          </div>
        </workspace-layout>
      </div>
    </div>
  );
}
