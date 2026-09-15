import { createEffect, createSignal, onCleanup } from "solid-js";

import { Button } from "./primitives.tsx";

export function HtmlPreview(
  props: {
    title: string;
    projectId: string;
    sessionId: string;
    artifactId: string;
    select(quote: string): void;
  },
) {
  let frame!: HTMLIFrameElement;
  const channel = crypto.randomUUID();
  const [selecting, setSelecting] = createSignal<"element" | "area">();
  const url = () =>
    `/artifact-preview?${new URLSearchParams({
      project: props.projectId,
      session: props.sessionId,
      artifact: props.artifactId,
      channel,
    })}`;
  const sync = () =>
    frame?.contentWindow?.postMessage({
      channel,
      mode: selecting(),
      color: getComputedStyle(document.documentElement).getPropertyValue(
        "--color-focus",
      ).trim(),
    }, "*");
  createEffect(sync);
  const receive = (event: MessageEvent) => {
    const value = event.data;
    if (
      !selecting() || event.source !== frame.contentWindow ||
      event.origin !== "null" || !value || value.channel !== channel ||
      !["element", "area", "cancel"].includes(value.kind)
    ) return;
    if (value.kind === "cancel") {
      setSelecting(undefined);
      return;
    }
    if (
      typeof value.selector !== "string" || value.selector.length > 1200 ||
      typeof value.text !== "string" || value.text.length > 2000
    ) return;
    const bounds = value.bounds;
    if (
      !bounds ||
      ![bounds.x, bounds.y, bounds.width, bounds.height].every((number) =>
        typeof number === "number" && Number.isFinite(number) &&
        Math.abs(number) <= 10_000_000
      )
    ) return;
    props.select(
      `Selection: ${value.kind}\n${
        value.kind === "area" ? "Center element" : "Element"
      }: ${value.selector}\nText: ${value.text}\nBounds (document CSS pixels): x=${bounds.x}, y=${bounds.y}, width=${bounds.width}, height=${bounds.height}`,
    );
    setSelecting(undefined);
  };
  const cancel = (event: KeyboardEvent) => {
    if (event.key === "Escape" && selecting()) {
      event.preventDefault();
      setSelecting(undefined);
    }
  };
  window.addEventListener("keydown", cancel);
  onCleanup(() => window.removeEventListener("keydown", cancel));
  window.addEventListener("message", receive);
  onCleanup(() => window.removeEventListener("message", receive));
  return (
    <div class="space-y-3">
      <div
        class="flex flex-wrap gap-3"
        role="group"
        aria-label="Preview feedback selection"
      >
        <Button
          variant="secondary"
          aria-pressed={selecting() === "element"}
          onClick={() =>
            setSelecting(selecting() === "element" ? undefined : "element")}
        >
          {selecting() === "element"
            ? "Cancel element selection"
            : "Select element"}
        </Button>
        <Button
          variant="secondary"
          aria-pressed={selecting() === "area"}
          onClick={() =>
            setSelecting(selecting() === "area" ? undefined : "area")}
        >
          {selecting() === "area" ? "Cancel area selection" : "Select area"}
        </Button>
      </div>
      <iframe
        ref={frame}
        class="artifact-preview"
        title={props.title}
        sandbox="allow-scripts"
        src={url()}
        onLoad={sync}
      />
    </div>
  );
}
