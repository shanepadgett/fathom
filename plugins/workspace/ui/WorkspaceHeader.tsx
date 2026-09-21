import { Show, type JSX } from "solid-js";
import { IconButton } from "@fathom/sdk/ui";

export function WorkspaceHeader(props: {
  sidebarAvailable: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSettings: () => void;
  children: JSX.Element;
}) {
  return (
    <header class="relative flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface pl-4">
      <div class="flex min-w-0 items-center gap-6">
        <span class="type-wordmark">
          Fathom<span class="text-action dark:text-teal-200">.</span>
        </span>
        <Show when={props.sidebarAvailable}>
          <IconButton
            icon="sidebar-simple"
            label={props.sidebarOpen ? "Close sidebar" : "Open sidebar"}
            toolbar
            sidebarToggle
            aria-expanded={props.sidebarOpen}
            onClick={() => props.onToggleSidebar()}
          />
        </Show>
      </div>
      <div class="flex h-full items-center">
        {props.children}
        <IconButton
          class="mx-3"
          icon="gear"
          label="Settings"
          toolbar
          onClick={() => props.onSettings()}
        />
      </div>
    </header>
  );
}
