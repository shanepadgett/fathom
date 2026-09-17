import type { Surface, SurfaceId } from "../../types.ts";

import { For, Show } from "solid-js";

export function FocusSwitch(props: {
  surfaces: Surface[];
  mode?: SurfaceId;
  onMode(id: SurfaceId): void;
}) {
  return (
    <Show when={props.surfaces.length > 1}>
      <div
        role="group"
        aria-label="Workspace focus"
        class="flex overflow-hidden rounded-control border border-line"
      >
        <For each={props.surfaces}>
          {(surface) => (
            <button
              type="button"
              aria-label={`${surface.label} focus`}
              aria-pressed={props.mode === surface.id}
              class={`flex h-8 items-center justify-center border-r border-line px-3 text-dense last:border-r-0 ${
                props.mode === surface.id ? "bg-canvas text-action" : "text-muted hover:text-ink"
              }`}
              onClick={() => props.onMode(surface.id)}
            >
              {surface.label}
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}
