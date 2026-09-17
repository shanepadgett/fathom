import type { JSX } from "solid-js";

import { createSignal, createUniqueId, onCleanup, onMount, Show } from "solid-js";

import { Button } from "./primitives.tsx";

export function MessagePreview(props: { collapsible: boolean; children: JSX.Element }) {
  const id = createUniqueId();
  const [expanded, setExpanded] = createSignal(false);
  const [overflows, setOverflows] = createSignal(false);
  let content!: HTMLDivElement;
  onMount(() => {
    const measure = () => {
      const style = getComputedStyle(content);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
      setOverflows(content.scrollHeight > lineHeight * 5 + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    measure();
    onCleanup(() => observer.disconnect());
  });
  const canCollapse = () => props.collapsible && overflows();
  return (
    <>
      <div
        id={id}
        onFocusIn={() => {
          if (canCollapse()) setExpanded(true);
        }}
        classList={{
          "message-preview-collapsed": canCollapse() && !expanded(),
        }}
      >
        <div ref={content}>{props.children}</div>
      </div>
      <Show when={canCollapse()}>
        <div class="mt-2">
          <Button
            aria-controls={id}
            aria-expanded={expanded()}
            onClick={() => setExpanded(!expanded())}
          >
            {expanded() ? "Show less" : "Expand message"}
          </Button>
        </div>
      </Show>
    </>
  );
}
