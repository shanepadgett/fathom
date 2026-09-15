import type { JSX } from "solid-js";

import { createResource, For, Show } from "solid-js";

import { Icon } from "./icon.tsx";

export interface FileItem {
  name: string;
  path: string;
  directory: boolean;
}

export function FileRow(
  props: {
    file: FileItem;
    selected: boolean;
    tree?: boolean;
    trailing?: JSX.Element;
    open(): void;
  },
) {
  return (
    <button
      type="button"
      data-file-row
      aria-current={props.selected ? "true" : undefined}
      title={props.file.path}
      onClick={props.open}
      class={`flex h-6 w-full min-w-0 items-center gap-1.5 rounded-sm pr-2 ${
        props.tree === false ? "pl-2" : "pl-5"
      } text-left ${
        props.selected ? "bg-action/10 text-action" : "text-ink hover:bg-canvas"
      }`}
    >
      <span
        class={`flex shrink-0 ${props.selected ? "text-action" : "text-muted"}`}
      >
        <Icon
          name={/\.tsx?$/.test(props.file.name) ? "file-ts" : "file-text"}
        />
      </span>
      <span class="min-w-0 flex-1 truncate">{props.file.name}</span>
      {props.trailing}
    </button>
  );
}

export function FolderRow(
  props: { name: string; expanded: boolean; toggle(): void },
) {
  return (
    <button
      type="button"
      class="flex h-6 w-full min-w-0 items-center gap-1.5 rounded-sm px-1 text-left hover:bg-canvas"
      aria-expanded={props.expanded}
      onClick={props.toggle}
    >
      <span class="flex items-center gap-1.5 text-muted">
        <Icon
          name={props.expanded ? "caret-down" : "caret-right"}
          size="small"
        />
        <Icon name={props.expanded ? "folder-open" : "folder"} />
      </span>
      <span class="truncate">{props.name}</span>
    </button>
  );
}

export function FileTree(props: {
  load(path: string): Promise<FileItem[]>;
  revision: number;
  selected: string;
  expanded: string[];
  toggle(path: string): void;
  open(path: string): void;
}) {
  function Directory(branch: { path: string }) {
    const [files, { refetch }] = createResource(
      () => [branch.path, props.revision] as const,
      ([path]) => props.load(path),
    );
    return (
      <>
        <Show when={files.loading && !files()}>
          <p class="px-2 py-1 text-muted">Loading…</p>
        </Show>
        <Show when={files.error}>
          <button class="px-2 py-1 text-danger" onClick={() => void refetch()}>
            Could not load folder. Retry
          </button>
        </Show>
        <For each={files()}>
          {(file) => (
            <Show
              when={file.directory}
              fallback={
                <FileRow
                  file={file}
                  selected={props.selected === file.path}
                  open={() => props.open(file.path)}
                />
              }
            >
              <FolderRow
                name={file.name}
                expanded={props.expanded.includes(file.path)}
                toggle={() => props.toggle(file.path)}
              />
              <Show when={props.expanded.includes(file.path)}>
                <div class="ml-2.5 border-l border-line pl-1.5">
                  <Directory path={file.path} />
                </div>
              </Show>
            </Show>
          )}
        </For>
      </>
    );
  }
  return (
    <nav
      data-component="file-tree"
      class="overflow-auto p-2 text-dense leading-none"
      aria-label="File explorer"
    >
      <Directory path="." />
    </nav>
  );
}
