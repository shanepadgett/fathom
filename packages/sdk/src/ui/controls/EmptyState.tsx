import type { JSX } from "solid-js";

export function EmptyState(props: { children: JSX.Element }): JSX.Element {
  return <p class="px-3 py-6 text-sm text-muted">{props.children}</p>;
}
