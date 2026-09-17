import type { JSX } from "solid-js";

import { createEffect, onCleanup, onMount } from "solid-js";

import { EdgeResizer } from "../../../design/primitives/edge-resizer.ts";

export function SplitPane(props: {
  first: JSX.Element;
  second: JSX.Element;
  label: string;
  width?: number;
  minFirst?: number;
  minSecond?: number;
  firstVisible?: boolean;
  secondVisible?: boolean;
  onResize?(width: number): void;
}) {
  let container!: HTMLDivElement;
  let first!: HTMLDivElement;
  let preferredWidth: number | undefined;
  const split = () => props.firstVisible !== false && props.secondVisible !== false;
  const minimum = (value: number | undefined) =>
    Number.isFinite(value) ? Math.max(0, value!) : 120;
  const bounds = () => {
    const available = container.clientWidth;
    const max = Math.max(0, available - Math.min(available, minimum(props.minSecond)));
    return { min: Math.min(minimum(props.minFirst), max), max };
  };
  const clamp = (width: number) => {
    const { min, max } = bounds();
    return Math.max(min, Math.min(max, width));
  };
  const size = () => {
    if (!split()) {
      first.style.width = "";
      return;
    }
    if (container.clientWidth) {
      preferredWidth ??= container.clientWidth / 2;
      first.style.width = `${clamp(preferredWidth)}px`;
    }
  };
  createEffect(() => {
    if (Number.isFinite(props.width)) preferredWidth = props.width;
    size();
  });
  onMount(() => {
    const handle = new EdgeResizer();
    handle.resizeOnWindow = false;
    handle.setAttribute("edge", "right");
    handle.bounds = bounds;
    createEffect(() => {
      if (split()) first.append(handle);
      else handle.remove();
    });
    const resized = (event: Event) => {
      preferredWidth = (event as CustomEvent<number>).detail;
      props.onResize?.(preferredWidth);
    };
    handle.addEventListener("edge-resize", resized);
    const observer = new ResizeObserver(() => {
      if (!split() || !container.clientWidth) return;
      size();
    });
    observer.observe(container);
    onCleanup(() => {
      observer.disconnect();
      handle.removeEventListener("edge-resize", resized);
      handle.remove();
    });
  });
  return (
    <div ref={container} class="flex h-full min-h-0 min-w-0">
      <div
        ref={first}
        aria-label={props.label}
        class="relative min-h-0 min-w-0"
        classList={{
          hidden: props.firstVisible === false,
          "w-1/2 shrink-0 border-r border-line": split(),
          "flex-1": !split(),
        }}
      >
        <div class="h-full min-h-0 overflow-auto">{props.first}</div>
      </div>
      <div
        class="min-h-0 min-w-0 flex-1 overflow-auto"
        classList={{ hidden: props.secondVisible === false }}
      >
        {props.second}
      </div>
    </div>
  );
}
