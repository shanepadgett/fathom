import type { JSX } from "solid-js";

import { createSignal } from "solid-js";

import { Icon } from "./icon.tsx";

export function Disclosure(props: {
  label: JSX.Element;
  open?: boolean;
  inset?: boolean;
  children: JSX.Element;
}) {
  const [expanded, setExpanded] = createSignal<boolean>();
  const open = () => expanded() ?? props.open ?? false;
  return (
    <details class="text-sm text-muted" open={open()}>
      <summary
        class="flex items-baseline gap-2 py-2"
        onClick={(event) => {
          event.preventDefault();
          setExpanded(!open());
        }}
      >
        <span class="shrink-0" classList={{ "rotate-90": open() }}>
          <Icon name="caret-right" size="small" />
        </span>
        {props.label}
      </summary>
      <div
        class={
          props.inset
            ? "ml-4 flex flex-col gap-3 border-l border-line py-2 pl-4"
            : "mt-2 flex flex-col gap-3"
        }
      >
        {props.children}
      </div>
    </details>
  );
}
