import { For, type JSX } from "solid-js";

export function ShortcutHint(props: {
  keys: string[];
  children: JSX.Element;
}): JSX.Element {
  return (
    <span class="flex items-center gap-1">
      <For each={props.keys}>
        {(key) => <kbd class="rounded-sm bg-line px-1">{key}</kbd>}
      </For>
      {props.children}
    </span>
  );
}
