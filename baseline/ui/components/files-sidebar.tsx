import type { FileEntry } from "../../types.ts";

import { For, Show } from "solid-js";

export function FilesSidebar(props: {
  nodes: FileEntry[];
  selected?: string;
  expanded: string[];
  view: "files" | "changes";
  onView(view: "files" | "changes"): void;
  onSelect(id: string): void;
  onToggle(id: string): void;
}) {
  return (
    <>
      <div
        class="flex h-9 shrink-0 border-b border-line text-sm"
        role="group"
        aria-label="Files and changes"
      >
        <button
          type="button"
          aria-pressed={props.view === "files"}
          class={`flex flex-1 items-center justify-center border-t-2 ${
            props.view === "files"
              ? "border-action bg-canvas text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
          onClick={() => props.onView("files")}
        >
          Files
        </button>
        <button
          type="button"
          aria-pressed={props.view === "changes"}
          class={`flex flex-1 items-center justify-center border-t-2 ${
            props.view === "changes"
              ? "border-action bg-canvas text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
          onClick={() => props.onView("changes")}
        >
          Changes
        </button>
      </div>
      <Show
        when={props.view === "files"}
        fallback={<p class="px-3 py-6 text-sm text-muted">No changes yet</p>}
      >
        <div
          data-component="file-tree"
          class="p-2 text-dense leading-none"
          aria-label="File explorer"
        >
          <For each={props.nodes}>
            {(node) => (
              <TreeNode
                node={node}
                selected={props.selected}
                expanded={props.expanded}
                onSelect={props.onSelect}
                onToggle={props.onToggle}
              />
            )}
          </For>
        </div>
      </Show>
    </>
  );
}

function TreeNode(props: {
  node: FileEntry;
  selected?: string;
  expanded: string[];
  onSelect(id: string): void;
  onToggle(id: string): void;
}) {
  const open = () => props.expanded.includes(props.node.id);
  return (
    <Show
      when={props.node.kind === "directory"}
      fallback={
        <button
          type="button"
          data-file-row
          class={`flex h-6 min-w-0 w-full items-center gap-1.5 rounded-sm pr-2 pl-5 text-left ${
            props.node.id === props.selected
              ? "bg-action/10 text-action"
              : "text-ink hover:bg-canvas"
          }`}
          aria-current={props.node.id === props.selected ? "true" : undefined}
          title={props.node.name}
          onClick={() => props.onSelect(props.node.id)}
        >
          <span
            class={`flex shrink-0 ${
              props.node.id === props.selected ? "text-action" : "text-muted"
            }`}
          >
            <i class="ph ph-file-text shrink-0 text-base" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1 truncate">{props.node.name}</span>
        </button>
      }
    >
      <div>
        <button
          type="button"
          class="flex h-6 w-full min-w-0 items-center gap-1.5 rounded-sm px-1 text-left hover:bg-canvas"
          aria-expanded={open()}
          onClick={() => props.onToggle(props.node.id)}
        >
          <span class="flex items-center gap-1.5 text-muted">
            <i
              class={`ph shrink-0 text-xs ${open() ? "ph-caret-down" : "ph-caret-right"}`}
              aria-hidden="true"
            />
            <i
              class={`ph shrink-0 text-base ${open() ? "ph-folder-open" : "ph-folder"}`}
              aria-hidden="true"
            />
          </span>
          <span class="truncate">{props.node.name}</span>
        </button>
        <Show when={open() && props.node.children?.length}>
          <div class="ml-2.5 border-l border-line pl-1.5">
            <For each={props.node.children}>
              {(child) => (
                <TreeNode
                  node={child}
                  selected={props.selected}
                  expanded={props.expanded}
                  onSelect={props.onSelect}
                  onToggle={props.onToggle}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}
