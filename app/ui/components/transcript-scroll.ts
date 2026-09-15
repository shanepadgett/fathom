import type { Accessor } from "solid-js";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";

export function createTranscriptScroll(options: {
  viewport(): HTMLDivElement;
  content(): HTMLDivElement;
  active: Accessor<boolean>;
  sessionId: Accessor<string | undefined>;
}) {
  const [detached, setDetached] = createSignal(false);
  let frame = 0;
  let top = 0;
  let session: string | undefined;

  function follow() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!options.active()) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const viewport = options.viewport();
      if (!options.active() || !viewport.clientHeight) return;
      viewport.scrollTop = detached() ? top : viewport.scrollHeight;
      top = viewport.scrollTop;
    });
  }

  function scroll() {
    const viewport = options.viewport();
    if (!options.active() || !viewport.clientHeight || frame) return;
    top = viewport.scrollTop;
    setDetached(viewport.scrollHeight - top - viewport.clientHeight > 90);
  }

  function bottom() {
    setDetached(false);
    follow();
  }

  function focus(element: HTMLElement) {
    cancelAnimationFrame(frame);
    frame = 0;
    element.scrollIntoView({ block: "start" });
    top = options.viewport().scrollTop;
    setDetached(true);
    element.focus({ preventScroll: true });
  }

  createEffect(() => {
    const next = options.sessionId();
    if (next !== session) {
      session = next;
      top = 0;
      setDetached(false);
    }
    options.active();
    follow();
  });
  onMount(() => {
    const observer = new ResizeObserver(follow);
    observer.observe(options.content());
    observer.observe(options.viewport());
    onCleanup(() => observer.disconnect());
  });
  onCleanup(() => cancelAnimationFrame(frame));
  return { detached, follow, scroll, bottom, focus };
}
