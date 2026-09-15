import type { FileRange } from "../../sdk/editor.ts";
import type { ToolExecution } from "../../sdk/session.ts";

import { createSignal, Show } from "solid-js";

import { Button } from "./primitives.tsx";
import { Icon } from "./icon.tsx";
import { toolFile, toolLabel } from "./tool-presentation.ts";

export function ToolCard(
  props: {
    execution: ToolExecution;
    openFile(path: string, range?: FileRange): void;
    openDiff(path: string): void;
  },
) {
  const [expanded, setExpanded] = createSignal<boolean>();
  const result = () =>
    props.execution.result ||
    (props.execution.status === "pending" ||
        props.execution.status === "running"
      ? "Waiting for output…"
      : props.execution.status === "aborted"
      ? "Cancelled without output."
      : props.execution.status === "error"
      ? "Tool failed without output."
      : "Completed without output.");
  return (
    <details
      class="group/tool my-4 text-sm text-muted"
      open={expanded() ?? props.execution.status === "running"}
    >
      <summary
        onClick={(event) => {
          event.preventDefault();
          setExpanded(!(expanded() ?? props.execution.status === "running"));
        }}
        class="flex items-baseline justify-between gap-4"
      >
        <span class="flex min-w-0 items-baseline gap-1 break-words">
          <span class="shrink-0 group-open/tool:rotate-90">
            <Icon name="caret-right" />
          </span>
          {toolLabel(props.execution)}
        </span>
        <span
          class={props.execution.status === "error"
            ? "text-danger"
            : "text-muted"}
        >
          {props.execution.status === "running"
            ? "Running"
            : props.execution.status === "pending"
            ? "Queued"
            : props.execution.status === "error"
            ? "Failed"
            : props.execution.status === "aborted"
            ? "Cancelled"
            : props.execution.durationMs !== undefined
            ? `${(props.execution.durationMs / 1000).toFixed(1)}s`
            : props.execution.status}
        </span>
      </summary>
      <div class="mt-2 min-w-0 break-words text-muted">
        <Show when={toolFile(props.execution)}>
          {(file) => (
            <div class="mb-3 flex flex-wrap gap-2">
              <Button onClick={() => props.openFile(file().path, file().range)}>
                Open file
              </Button>
              <Show when={file().changed}>
                <Button
                  onClick={() => props.openDiff(file().path)}
                >
                  Review current changes
                </Button>
              </Show>
            </div>
          )}
        </Show>
        <p class="mb-2 text-xs font-medium">Call</p>
        <pre
          class="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-control bg-canvas p-3 font-mono text-xs"
          tabindex="0"
          aria-label={`${props.execution.name} arguments`}
        >{JSON.stringify(props.execution.args, null, 2)}</pre>
        <div class="mb-2 mt-3 flex justify-between gap-2">
          <p class="text-xs font-medium">Result</p>
          <span class="text-xs">Drag to resize</span>
        </div>
        <pre
          class="h-40 min-h-24 resize-y overflow-auto whitespace-pre-wrap break-words rounded-control border border-line bg-canvas p-3 font-mono text-xs"
          tabindex="0"
          aria-label={`${props.execution.name} result`}
        >{result()}</pre>
      </div>
    </details>
  );
}
