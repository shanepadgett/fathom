import type { createWorkspace } from "../state/workspace.ts";

import { For, Show } from "solid-js";

import { Icon } from "./icon.tsx";
import { IconButton } from "./primitives.tsx";

/** Presentation follows design/components/workspace/workspace-header.ts. */
export function WorkspaceHeader(props: { app: ReturnType<typeof createWorkspace> }) {
  const app = props.app;
  return (
    <header class="relative flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface pl-4">
      <div class="flex min-w-0 items-center gap-6">
        <span class="whitespace-nowrap font-bold tracking-tight">
          Fathom<span class="text-action dark:text-teal-200">.</span>
        </span>
        <IconButton
          name="sidebar-simple"
          label={app.sidebarOpen() ? "Close sidebar" : "Open sidebar"}
          toolbar
          expanded={app.sidebarOpen()}
          onClick={() => app.setSidebarOpen((value) => !value)}
        />
      </div>
      <div class="absolute left-1/2 -translate-x-1/2">
        <div
          role="group"
          aria-label="Workspace focus"
          class="flex overflow-hidden rounded-control border border-line"
        >
          <For each={["editor", "agent", "chat"]}>
            {(mode) => (
              <button
                type="button"
                aria-label={`${mode[0].toUpperCase() + mode.slice(1)} focus`}
                aria-pressed={app.mode() === mode}
                class={`flex h-8 items-center justify-center border-r border-line px-3 text-dense last:border-r-0 ${
                  app.mode() === mode ? "bg-canvas text-action" : "text-muted hover:text-ink"
                }`}
                onClick={() => app.setMode(mode)}
              >
                {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            )}
          </For>
        </div>
      </div>
      <div class="flex h-full items-center">
        <IconButton
          name="browser"
          label={
            app.browserVisible()
              ? "Hide browser"
              : app.mode() === "editor"
                ? "Show browser beside editor"
                : "Open integrated browser"
          }
          toolbar
          pressed={app.browserVisible()}
          onClick={app.toggleBrowser}
        />
        <Show when={app.mode() !== "chat"}>
          <button
            type="button"
            aria-label={app.mode() === "editor" ? "Open agent drawer" : "Open diff drawer"}
            title={app.mode() === "editor" ? "Open agent drawer" : "Open diff drawer"}
            class="flex h-full w-12 shrink-0 items-center justify-center border-l border-line text-action hover:bg-canvas"
            onClick={() =>
              app.mode() === "editor" ? app.setAgentDrawer((value) => !value) : app.openDiff()
            }
          >
            <Icon name="caret-double-left" size="toolbar" />
          </button>
        </Show>
      </div>
    </header>
  );
}
