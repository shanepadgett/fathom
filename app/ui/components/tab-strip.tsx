import { For } from "solid-js";

export function TabStrip<T extends string>(
  props: {
    items: { id: T; label: string }[];
    selected: T;
    label: string;
    select(id: T): void;
  },
) {
  return (
    <div
      class="flex h-9 shrink-0 border-b border-line text-sm"
      role="group"
      aria-label={props.label}
    >
      <For each={props.items}>
        {(item) => (
          <button
            type="button"
            aria-pressed={item.id === props.selected}
            onClick={() => props.select(item.id)}
            class={`flex flex-1 items-center justify-center border-t-2 ${
              item.id === props.selected
                ? "border-action bg-canvas text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        )}
      </For>
    </div>
  );
}
