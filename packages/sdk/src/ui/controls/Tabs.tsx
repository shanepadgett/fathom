import { createEffect, For, onCleanup, type JSX } from "solid-js";
import { rovingFocus } from "./roving-focus.ts";

export interface TabItem {
  id: string;
  label: string;
}

/** Reference tab strip with roving focus; aria-pressed marks the active tab. */
export function Tabs(props: {
  items: TabItem[];
  selected: string;
  label: string;
  onSelect: (id: string) => void;
}): JSX.Element {
  let strip!: HTMLDivElement;

  createEffect(() => onCleanup(rovingFocus(strip, "button", "horizontal")));

  return (
    <div
      ref={(element) => {
        strip = element;
      }}
      class="flex h-9 shrink-0 border-b border-line text-sm"
      role="group"
      aria-label={props.label}
    >
      <For each={props.items}>
        {(item) => (
          <button
            type="button"
            aria-pressed={item.id === props.selected}
            class={`flex flex-1 items-center justify-center border-t-2 ${
              item.id === props.selected
                ? "border-action bg-canvas text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
            onClick={() => props.onSelect(item.id)}
          >
            {item.label}
          </button>
        )}
      </For>
    </div>
  );
}
