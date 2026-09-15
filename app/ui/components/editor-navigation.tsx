import { For, Show } from "solid-js";

import { IconButton } from "./primitives.tsx";

export function EditorTabs(props: {
  paths: string[];
  selected: string;
  dirty(path: string): boolean;
  select(path: string): void;
  close(path: string): void;
}) {
  return (
    <div
      class="flex h-9 shrink-0 overflow-x-auto border-b border-line bg-surface text-sm"
      role="group"
      aria-label="Open files"
    >
      <For each={props.paths}>
        {(path) => (
          <div
            class={`flex shrink-0 items-center gap-3 border-r border-line px-4 ${
              props.selected === path
                ? "border-t-2 border-t-action bg-canvas"
                : "text-muted"
            }`}
          >
            <button
              type="button"
              aria-pressed={props.selected === path}
              title={path}
              class="truncate"
              onClick={() => props.select(path)}
            >
              {path.split("/").at(-1)}
            </button>
            <Show when={props.dirty(path)}>
              <span class="text-warning" aria-label="Unsaved changes">●</span>
            </Show>
            <IconButton
              name="x"
              label={`Close ${path}`}
              onClick={() => props.close(path)}
            />
          </div>
        )}
      </For>
    </div>
  );
}

export function FileBreadcrumbs(props: { path: string }) {
  return (
    <p
      data-component="breadcrumbs"
      class="flex h-9 shrink-0 items-center gap-1 overflow-hidden border-b border-line px-4 text-sm text-muted"
    >
      <For each={props.path.split("/").filter(Boolean)}>
        {(part, index) => (
          <>
            <Show when={index()}>
              <span aria-hidden="true">/</span>
            </Show>
            <span
              class={`truncate ${
                index() === props.path.split("/").length - 1 ? "text-ink" : ""
              }`}
            >
              {part}
            </span>
          </>
        )}
      </For>
    </p>
  );
}
