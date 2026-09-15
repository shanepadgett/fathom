import { Show } from "solid-js";

import { Disclosure } from "./disclosure.tsx";
import { Markdown } from "./markdown.tsx";

export function CompactionNotice(props: {
  data?: unknown;
  detailed?: boolean;
  pending?: boolean;
}) {
  const data = () =>
    props.data && typeof props.data === "object"
      ? props.data as Record<string, unknown>
      : {};
  const summary = () =>
    typeof data().summary === "string" ? String(data().summary) : "";
  const count = () => {
    const value = data().messagesCompacted;
    return typeof value === "number" && Number.isSafeInteger(value) &&
        value >= 0
      ? value
      : undefined;
  };
  const saved = () => {
    const value = data().estimatedTokensSaved;
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0
      ? value.toLocaleString()
      : undefined;
  };
  return (
    <Disclosure
      label={
        <span
          role="status"
          classList={{ "tool-execution-working": !!props.pending }}
        >
          {props.pending ? "Compacting context…" : "Context compacted"}
          <Show when={!props.pending && saved()}>
            <span class="ml-2 text-xs">~{saved()} tokens freed</span>
          </Show>
        </span>
      }
      open={props.detailed}
    >
      <Show
        when={props.pending}
        fallback={
          <>
            <p class="mb-3 text-sm text-muted">
              {count() === undefined
                ? "Earlier context was summarized."
                : `${count()} earlier messages summarized.`}{" "}
              The original conversation remains available above.
            </p>
            <Show when={summary()}>
              <Markdown text={summary()} />
            </Show>
          </>
        }
      >
        <p class="text-sm text-muted">
          Summarizing earlier messages to make room for the next steps. Your
          original conversation is preserved. The agent will resume
          automatically.
        </p>
      </Show>
    </Disclosure>
  );
}
