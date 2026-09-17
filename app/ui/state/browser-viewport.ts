import type { BrowserViewport } from "../../sdk/browser.ts";
import type { Transport } from "../transport.ts";

import { createEffect, onCleanup, onMount } from "solid-js";

import { nativeSurfacesOccluded } from "./native-surfaces.ts";

export function browserViewport(
  transport: Transport,
  element: () => HTMLElement,
  viewId: () => string,
  ready: () => boolean,
  annotating: () => boolean,
  error: (failure: unknown) => void,
) {
  let frame = 0;
  let closed = false;
  let sending = false;
  let previous = "";
  let pending: { viewId: string; bounds: BrowserViewport } | undefined;
  const flush = async () => {
    if (sending) return;
    sending = true;
    try {
      while (pending) {
        const request = pending;
        pending = undefined;
        try {
          await transport.request("browser.viewport", {
            viewId: request.viewId,
            ...request.bounds,
          });
        } catch (failure) {
          if (!closed && viewId() === request.viewId && ready()) error(failure);
        }
      }
    } finally {
      sending = false;
    }
  };
  const measure = () => {
    frame = 0;
    if (closed || !element() || !viewId()) return;
    const target = element();
    const rect = target.getBoundingClientRect();
    const clip = target.parentElement?.getBoundingClientRect() ?? rect;
    const bounds: BrowserViewport = {
      x: Math.max(0, Math.round(rect.x)),
      y: Math.max(0, Math.round(rect.y)),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
      visible:
        ready() &&
        !annotating() &&
        !nativeSurfacesOccluded() &&
        document.visibilityState === "visible" &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.left >= Math.max(0, clip.left) &&
        rect.top >= Math.max(0, clip.top) &&
        rect.right <= Math.min(innerWidth, clip.right) + 1 &&
        rect.bottom <= Math.min(innerHeight, clip.bottom) + 1,
    };
    const key = JSON.stringify([transport.projectId, viewId(), ready(), bounds]);
    if (key === previous) return;
    previous = key;
    pending = { viewId: viewId(), bounds };
    void flush();
  };
  const schedule = () => {
    if (!closed && !frame) frame = requestAnimationFrame(measure);
  };
  createEffect(() => {
    viewId();
    ready();
    annotating();
    nativeSurfacesOccluded();
    schedule();
  });
  onMount(() => {
    const observer = new ResizeObserver(schedule);
    observer.observe(element());
    if (element().parentElement) observer.observe(element().parentElement!);
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    document.addEventListener("visibilitychange", schedule);
    schedule();
    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      document.removeEventListener("visibilitychange", schedule);
    });
  });
  onCleanup(() => {
    closed = true;
    cancelAnimationFrame(frame);
    pending = undefined;
    // browser.detach owns hiding after unmount, independent of RPC ordering.
  });
}
