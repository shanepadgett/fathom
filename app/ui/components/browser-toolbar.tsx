import { Show } from "solid-js";

import { IconButton } from "./primitives.tsx";
import { SelectorButton } from "./selector-button.tsx";

export type AnnotationMode = "point" | "area";

export function BrowserToolbar(props: {
  address: string;
  changeAddress(value: string): void;
  navigate(): void;
  reload(): void;
  ready: boolean;
  annotationMode?: AnnotationMode;
  staging: boolean;
  annotate(mode: AnnotationMode): void;
  serverCount: number;
  selectServer(): void;
  close(): void;
  docked?: boolean;
  switchSurface?(): void;
}) {
  return (
    <header class="flex flex-wrap items-center gap-2 border-b border-line p-2">
      <form
        class="flex min-w-48 flex-1 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (props.address.trim()) props.navigate();
        }}
      >
        <IconButton
          name="arrow-counter-clockwise"
          label="Reload page"
          disabled={!props.ready}
          onClick={props.reload}
        />
        <input
          class="min-w-0 flex-1 text-sm"
          aria-label="Browser address"
          placeholder="Enter a URL…"
          spellcheck={false}
          value={props.address}
          onInput={(event) => props.changeAddress(event.currentTarget.value)}
        />
        <IconButton
          name="caret-right"
          label="Go to address"
          type="submit"
          disabled={!props.address.trim()}
        />
      </form>
      <div
        class="flex shrink-0 items-center gap-2"
        role="group"
        aria-label="Browser actions"
      >
        <IconButton
          name="note-pencil"
          label="Annotate a point"
          pressed={props.annotationMode === "point"}
          disabled={!props.ready || props.staging}
          onClick={() => props.annotate("point")}
        />
        <IconButton
          name="selection"
          label="Annotate an area"
          pressed={props.annotationMode === "area"}
          disabled={!props.ready || props.staging}
          onClick={() => props.annotate("area")}
        />
        <SelectorButton
          value="Servers"
          secondary={String(props.serverCount)}
          label={`Select a development server (${props.serverCount} available)`}
          onClick={props.selectServer}
        />
        <Show when={props.switchSurface}>
          <IconButton
            name={props.docked ? "arrows-out" : "columns"}
            label={props.docked
              ? "Use browser as active surface"
              : "Dock browser beside editor"}
            onClick={() => props.switchSurface?.()}
          />
        </Show>
        <IconButton name="x" label="Close browser view" onClick={props.close} />
      </div>
    </header>
  );
}
