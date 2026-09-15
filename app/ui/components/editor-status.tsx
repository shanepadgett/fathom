import type { JSX } from "solid-js";

import { Show } from "solid-js";

export interface EditorPosition {
  line: number;
  column: number;
  language: string;
}

export function EditorStatus(
  props: {
    server?: { name?: string; running: boolean; error?: string };
    position?: EditorPosition;
    errors: number;
    warnings: number;
    children?: JSX.Element;
  },
) {
  return (
    <footer class="flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 py-2 text-xs text-muted">
      <span title={props.server?.error}>
        Problems{" "}
        <Show
          when={props.server && !props.server.running &&
            props.server.name !== "No language server"}
        >
          <span class="ml-3 text-warning">Language server unavailable</span>
        </Show>
        <Show when={props.errors}>
          <span class="ml-3 text-danger">
            {props.errors} {props.errors === 1 ? "error" : "errors"}
          </span>
        </Show>
        <Show when={props.warnings}>
          <span class="ml-3 text-warning">
            {props.warnings} {props.warnings === 1 ? "warning" : "warnings"}
          </span>
        </Show>
        <Show when={props.server?.running && !props.errors && !props.warnings}>
          <span class="ml-3">No diagnostics reported</span>
        </Show>
      </span>
      <div class="flex items-center gap-3">
        {props.children}
        <Show
          when={props.position}
          fallback={<span>Select a file to edit</span>}
        >
          {(position) => (
            <span>
              Ln {position().line}, Col {position().column} · UTF-8 ·{" "}
              {position().language}
            </span>
          )}
        </Show>
      </div>
    </footer>
  );
}
