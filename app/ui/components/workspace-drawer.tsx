import type { JSX } from "solid-js";

import { onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";

import { EdgeResizer } from "../../../design/primitives/edge-resizer.ts";
import { occludeNativeSurfaces } from "../state/native-surfaces.ts";
import { Icon } from "./icon.tsx";

export function DrawerControl(props: { kind: "agent" | "diff"; close(): void }) {
  return (
    <button
      type="button"
      aria-label={`Close ${props.kind} drawer`}
      title={`Close ${props.kind} drawer`}
      class="flex h-full w-12 shrink-0 items-center justify-center border-l border-line bg-action text-on-action"
      onClick={props.close}
    >
      <Icon name="caret-double-right" size="toolbar" />
    </button>
  );
}

/** Keeps conversation state mounted when switching between a page and drawer. */
export function WorkspaceDrawer(props: {
  kind: "agent" | "diff";
  enabled?: boolean;
  mount?: HTMLElement;
  open?: boolean;
  close(): void;
  children: JSX.Element;
}) {
  let scrim!: HTMLDivElement;
  let panel!: HTMLDivElement;
  const enabled = () => props.enabled !== false;
  occludeNativeSurfaces(() => enabled() && props.open !== false);
  onMount(() => {
    const handle = new EdgeResizer();
    handle.setAttribute("edge", "left");
    handle.bounds = () => {
      const max = Math.max(1, Math.min(1200, scrim.clientWidth - 80));
      return { min: Math.min(280, max), max };
    };
    panel.append(handle);
    const escape = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.key !== "Escape" ||
        !enabled() ||
        props.open === false ||
        document.querySelector("dialog[open], [popover]:popover-open")
      )
        return;
      const visible = [...document.querySelectorAll<HTMLElement>(".workspace-drawer-panel")].filter(
        (element) => element.getClientRects().length,
      );
      if (visible.at(-1) !== panel) return;
      event.preventDefault();
      props.close();
    };
    document.addEventListener("keydown", escape);
    onCleanup(() => {
      handle.remove();
      document.removeEventListener("keydown", escape);
    });
  });
  const content = (
    <div
      ref={scrim}
      classList={{
        contents: !enabled(),
        "absolute inset-0 z-20 overlay-glass": enabled(),
        hidden: enabled() && props.open === false,
      }}
      onClick={(event) => {
        if (enabled() && event.target === scrim) props.close();
      }}
    >
      <div
        ref={panel}
        role={enabled() ? "region" : undefined}
        aria-label={
          enabled() ? `${props.kind === "agent" ? "Agent" : "File diff"} drawer` : undefined
        }
        classList={{
          contents: !enabled(),
          "workspace-drawer-panel pointer-events-auto absolute inset-y-0 right-0 z-10 flex max-w-full flex-col border-l border-line bg-canvas shadow-md":
            enabled(),
          "w-conversation-drawer": enabled() && props.kind === "agent",
          "w-diff-drawer": enabled() && props.kind === "diff",
        }}
      >
        {props.children}
      </div>
    </div>
  );
  return props.mount ? <Portal mount={props.mount}>{content}</Portal> : content;
}
