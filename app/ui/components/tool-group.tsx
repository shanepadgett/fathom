import type { FileRange } from "../../sdk/editor.ts";
import type { ToolExecution } from "../../sdk/session.ts";

import { For, Show } from "solid-js";

import { Disclosure } from "./disclosure.tsx";
import { toolSummary } from "./tool-presentation.ts";
import { ToolCard } from "./tool-card.tsx";

export function ToolGroup(
  props: {
    executions: ToolExecution[];
    detailed: boolean;
    grouped?: boolean;
    openFile(path: string, range?: FileRange): void;
    openDiff(path: string): void;
  },
) {
  const running = () =>
    props.executions.some((run) =>
      run.status === "running" || run.status === "pending"
    );
  const cards = () => (
    <For each={props.executions.map((run) => run.id)}>
      {(id) => (
        <ToolCard
          openFile={props.openFile}
          openDiff={props.openDiff}
          execution={props.executions.find((run) => run.id === id)!}
        />
      )}
    </For>
  );
  return (
    <Show when={props.executions.length}>
      <Show when={!props.grouped} fallback={cards()}>
        <Disclosure
          open={props.detailed}
          label={
            <span
              class="min-w-0 break-words"
              classList={{ "tool-execution-working": running() }}
              aria-live="polite"
            >
              {toolSummary(props.executions)}
            </span>
          }
        >
          {cards()}
        </Disclosure>
      </Show>
    </Show>
  );
}
