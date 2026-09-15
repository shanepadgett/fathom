import type { JSX } from "solid-js";
import type { Entry, ToolExecution } from "../../sdk/session.ts";

import { Show } from "solid-js";

import { Disclosure } from "./disclosure.tsx";
import { toolSummary } from "./tool-presentation.ts";

export function activityOnly(entry: Entry) {
  const message = entry.message;
  return message?.role === "assistant" &&
    !message.content.some((block) =>
      block.type === "text" && block.text.trim()
    );
}

/** Agent prose is a boundary; model/tool round trips are not. */
export function transcriptSegments(
  entries: Entry[],
  custom: (entry: Entry) => boolean,
): Entry[][] {
  const result: Entry[][] = [];
  const append = (entry: Entry) => {
    const previous = result.at(-1);
    if (activityOnly(entry) && previous && activityOnly(previous[0])) {
      previous.push(entry);
    } else result.push([entry]);
  };
  for (const entry of entries) {
    const message = entry.message;
    if (
      message?.role === "assistant" && !custom(entry) && !activityOnly(entry) &&
      message.content.some((block) =>
        block.type === "thinking" && !block.redacted && block.thinking.trim()
      )
    ) {
      append({
        ...entry,
        id: `${entry.id}:thinking`,
        message: {
          ...message,
          content: message.content.filter((block) => block.type === "thinking"),
        },
      });
      append({
        ...entry,
        message: {
          ...message,
          content: message.content.filter((block) => block.type !== "thinking"),
        },
      });
    } else append(entry);
  }
  return result;
}

export function TranscriptActivity(props: {
  entries: Entry[];
  executions: ToolExecution[];
  detailed: boolean;
  children: JSX.Element;
}) {
  const running = () =>
    props.entries.some((entry) => entry.status === "pending") ||
    props.executions.some((run) => ["running", "pending"].includes(run.status));
  return (
    <Show when={activityOnly(props.entries[0])} fallback={props.children}>
      <Disclosure
        open={props.detailed}
        inset
        label={
          <span classList={{ "tool-execution-working": running() }}>
            {props.executions.length
              ? toolSummary(props.executions)
              : "Thinking"}
          </span>
        }
      >
        {props.children}
      </Disclosure>
    </Show>
  );
}
