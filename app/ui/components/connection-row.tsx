import type { JSX } from "solid-js";

import { Show } from "solid-js";

export function ConnectionRow(props: {
  name: string;
  status: string;
  avatar?: string;
  children: JSX.Element;
}) {
  return (
    <div class="flex min-w-0 items-center gap-3 border-b border-line py-4">
      <Show when={props.avatar}>
        <span
          aria-hidden="true"
          class="grid h-8 w-8 shrink-0 place-items-center rounded-control border border-line text-base"
        >
          {props.avatar}
        </span>
      </Show>
      <div class="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <strong class="break-words font-medium">{props.name}</strong>
        <span class="break-words text-xs text-muted">{props.status}</span>
      </div>
      <div class="shrink-0">{props.children}</div>
    </div>
  );
}
