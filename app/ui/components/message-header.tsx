import { Show } from "solid-js";

export function MessageHeader(props: {
  author: string;
  agent: boolean;
  working: boolean;
  model?: string;
  createdAt: number;
}) {
  return (
    <header class="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 class={`min-w-0 break-words text-base font-semibold ${props.agent ? "text-action" : ""}`}>
        {props.author}
      </h3>
      <Show when={props.working}>
        <span class="sr-only">Working</span>
        <span class="identity-motion identity-motion-pages" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </Show>
      <Show when={props.model}>
        <span class="text-sm text-muted">{props.model}</span>
      </Show>
      <Show when={!props.working}>
        <span class="text-sm text-muted">
          {new Date(props.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </Show>
    </header>
  );
}
