import type { JSX } from "solid-js";
import type { FileDiff as DiffDocument } from "../../sdk/git.ts";

import { createMemo, Show } from "solid-js";

import { diffLines } from "./diff-preview.tsx";
import { FileBreadcrumbs } from "./editor-navigation.tsx";
import { FileDiff } from "./file-diff.tsx";
import { DrawerControl, WorkspaceDrawer } from "./workspace-drawer.tsx";

export function DiffDrawer(props: {
  projectId?: string;
  mount?: HTMLElement;
  document?: DiffDocument;
  theme: string;
  count?: number;
  refreshing?: boolean;
  stale?: boolean;
  refresh(): void;
  close(): void;
  children?: JSX.Element;
  footer?: JSX.Element;
}) {
  const lines = createMemo(() => diffLines(props.document?.patch ?? ""));
  const count = (kind: "added" | "removed") =>
    lines().filter((line) => line.kind === kind).length;
  return (
    <WorkspaceDrawer kind="diff" close={props.close} mount={props.mount}>
      <header class="flex h-12 shrink-0 items-center justify-between border-b border-line pl-6 font-medium">
        <span>
          Changed files{" "}
          <Show when={props.count !== undefined}>
            <span class="ml-3 text-sm text-muted">{props.count}</span>
          </Show>
        </span>
        <DrawerControl kind="diff" close={props.close} />
      </header>
      {props.children}
      <Show when={props.document}>
        {(file) => (
          <>
            <FileBreadcrumbs path={file().path} />
            <div
              class="flex shrink-0 gap-2 border-b border-line px-6 py-2 font-mono text-sm"
              aria-label="Changed line counts"
            >
              <span class="text-success">+{count("added")}</span>
              <span class="text-danger">−{count("removed")}</span>
            </div>
            <FileDiff
              projectId={props.projectId}
              document={file()}
              theme={props.theme}
              fill
              refresh={props.refresh}
              refreshing={props.refreshing}
              stale={props.stale}
            />
          </>
        )}
      </Show>
      <Show when={props.footer}>
        <div class="flex shrink-0 items-center justify-between border-t border-line px-6 py-2">
          {props.footer}
        </div>
      </Show>
    </WorkspaceDrawer>
  );
}
