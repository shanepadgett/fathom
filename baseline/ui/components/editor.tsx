import type { FileEntry } from "../../types.ts";

import { For, Show, createEffect, createSignal, onMount } from "solid-js";

import * as api from "../api.ts";
import { FilesSidebar } from "./files-sidebar.tsx";

export function Editor(props: { sidebarOpen: boolean }) {
  const [nodes, setNodes] = createSignal<FileEntry[]>([]);
  const [selected, setSelected] = createSignal<string>();
  const [expanded, setExpanded] = createSignal<string[]>([]);
  const [view, setView] = createSignal<"files" | "changes">("files");
  const [open, setOpen] = createSignal<FileEntry[]>([]);
  const [text, setText] = createSignal("");
  const [error, setError] = createSignal<string>();

  onMount(async () => {
    const tree = await api.tree();
    setNodes(tree);
    setExpanded(tree.filter((node) => node.kind === "directory").map((node) => node.id));
  });

  createEffect(() => {
    const path = selected();
    if (!path) {
      setText("");
      setError(undefined);
      return;
    }
    void api
      .file(path)
      .then((file) => {
        setText(file.text);
        setError(undefined);
      })
      .catch((caught) => {
        setText("");
        setError(caught instanceof Error ? caught.message : String(caught));
      });
  });

  const current = () => open().find((file) => file.id === selected());
  const crumbs = () => (selected() ?? "").split("/").filter(Boolean);
  const lines = () => text().split("\n");

  function select(id: string) {
    setSelected(id);
    setOpen((files) =>
      files.some((file) => file.id === id)
        ? files
        : [...files, { id, name: id.split("/").at(-1) ?? id, kind: "file" }],
    );
  }

  function close(id: string) {
    const next = open().filter((file) => file.id !== id);
    setOpen(next);
    if (selected() === id) setSelected(next.at(-1)?.id);
  }

  return (
    <>
      <workspace-sidebar
        placement="files"
        role="complementary"
        aria-label="Workspace files"
        hidden={!props.sidebarOpen}
      >
        <FilesSidebar
          nodes={nodes()}
          selected={selected()}
          expanded={expanded()}
          view={view()}
          onView={setView}
          onSelect={select}
          onToggle={(id) =>
            setExpanded((ids) =>
              ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
            )
          }
        />
      </workspace-sidebar>
      <section
        data-component="editor-pane"
        class="flex min-w-0 flex-1 flex-col"
        aria-label="Code editor"
      >
        <div
          class="flex h-9 shrink-0 overflow-hidden border-b border-line bg-surface text-sm"
          role="group"
          aria-label="Open files"
        >
          <For each={open()}>
            {(file) => (
              <div
                class={`flex items-center gap-3 border-r border-line px-4 ${
                  file.id === selected() ? "border-t-2 border-t-action bg-canvas" : "text-muted"
                }`}
              >
                <button
                  type="button"
                  aria-pressed={file.id === selected()}
                  class="truncate"
                  onClick={() => setSelected(file.id)}
                >
                  {file.name}
                </button>
                <ds-button variant="quiet" size="small" icon-only>
                  <button
                    type="button"
                    aria-label={`Close ${file.name}`}
                    title={`Close ${file.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      close(file.id);
                    }}
                  >
                    <i class="ph ph-x shrink-0 text-base" aria-hidden="true" />
                  </button>
                </ds-button>
              </div>
            )}
          </For>
        </div>
        <p
          data-component="breadcrumbs"
          class="flex h-9 shrink-0 items-center gap-1 overflow-hidden border-b border-line px-4 text-sm text-muted"
        >
          <For each={crumbs()}>
            {(part, index) => (
              <>
                <Show when={index() > 0}>
                  <span aria-hidden="true">/</span>
                </Show>
                <span class={`truncate ${index() === crumbs().length - 1 ? "text-ink" : ""}`}>
                  {part}
                </span>
              </>
            )}
          </For>
        </p>
        <Show when={!error()} fallback={<p class="px-6 py-4 text-sm text-danger">{error()}</p>}>
          <Show
            when={current()}
            fallback={<p class="px-6 py-4 text-sm text-muted">Open a file from the sidebar.</p>}
          >
            <div class="flex min-h-0 flex-1 overflow-auto py-4">
              <pre
                class="select-none border-r border-line px-4 text-right font-mono text-sm leading-relaxed text-muted"
                aria-hidden="true"
              >
                {lines()
                  .map((_, index) => index + 1)
                  .join("\n")}
              </pre>
              <pre
                class="whitespace-normal px-6 font-mono text-sm leading-relaxed"
                aria-label={current()?.name}
              >
                <For each={lines()}>
                  {(line) => <span class="block whitespace-pre">{line || " "}</span>}
                </For>
              </pre>
            </div>
          </Show>
        </Show>
        <div class="flex justify-between gap-3 border-t border-line px-4 py-2 text-xs text-muted">
          <span>{current() ? current()!.id : "No file"}</span>
          <span>{current() ? `Ln ${lines().length} · UTF-8` : ""}</span>
        </div>
      </section>
    </>
  );
}
