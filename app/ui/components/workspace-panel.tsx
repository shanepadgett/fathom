import type { JSX } from "solid-js";

import { onMount } from "solid-js";

import { EdgeResizer } from "../../../design/primitives/edge-resizer.ts";
import { IconButton } from "./primitives.tsx";

export function WorkspacePanel(
  props: { title: string; close(): void; children: JSX.Element },
) {
  let panel!: HTMLElement;
  onMount(() => {
    const handle = new EdgeResizer();
    handle.setAttribute("edge", "left");
    handle.bounds = () => {
      const available = panel.parentElement?.clientWidth ?? innerWidth;
      const max = Math.max(1, Math.min(1200, available - 80));
      return { min: Math.min(280, max), max };
    };
    panel.prepend(handle);
  });
  return (
    <aside
      ref={panel}
      aria-label={props.title}
      class="relative z-20 flex min-h-0 w-diff-drawer max-w-[calc(100%-80px)] shrink-0 flex-col border-l border-line bg-canvas"
    >
      <header class="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-4 font-medium">
        <h2 class="m-0 text-sm font-medium">{props.title}</h2>
        <IconButton
          name="x"
          label={`Close ${props.title}`}
          onClick={props.close}
        />
      </header>
      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 text-sm">
        {props.children}
      </div>
    </aside>
  );
}
