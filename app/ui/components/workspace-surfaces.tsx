import type { JSX } from "solid-js";

import { SplitPane } from "./split-pane.tsx";

/** Layout only: editor documents and browser ownership stay in their existing surfaces. */
export function WorkspaceSurfaces(props: {
  editorVisible: boolean;
  browserVisible: boolean;
  editor: JSX.Element;
  browser: JSX.Element;
  width?: number;
  resize(width: number): void;
}) {
  return (
    <div class="min-h-0 min-w-0 flex-1 overflow-hidden">
      <SplitPane
        label="Editor and browser split"
        width={props.width}
        minFirst={320}
        minSecond={300}
        firstVisible={props.editorVisible}
        secondVisible={props.browserVisible}
        onResize={props.resize}
        first={<div class="flex h-full min-h-0 min-w-0">{props.editor}</div>}
        second={<div class="flex h-full min-h-0 min-w-0">{props.browser}</div>}
      />
    </div>
  );
}
