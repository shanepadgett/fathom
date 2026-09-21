import type { JSX } from "solid-js";

/** Non-interactive compact label; the detail is announced on hover. */
export function Chip(props: {
  detail?: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <span
      class="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-control-line bg-surface px-3 py-2 text-sm"
      title={props.detail}
    >
      {props.children}
    </span>
  );
}
