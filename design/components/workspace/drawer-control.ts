import { html } from "lit";

import { icon } from "../../primitives/icon.ts";

/** Static drawer affordance shared by workspace and drawer title bars. */
export const drawerControl = (kind: "agent" | "diff", open = false) =>
  html`
    <button
      type="button"
      aria-label="${open ? "Close" : "Open"} ${kind} drawer"
      title="${open ? "Close" : "Open"} ${kind} drawer"
      class="flex h-full w-12 shrink-0 items-center justify-center border-l border-line ${open
        ? "bg-action text-on-action"
        : "text-action hover:bg-canvas"}"
    >
      ${icon(open ? "caret-double-right" : "caret-double-left", "toolbar")}
    </button>
  `;
