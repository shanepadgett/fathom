import type { BrowserAnnotationBounds } from "../../sdk/browser.ts";

/** Coordinates are CSS pixels in the captured page viewport. */
export function AnnotationArea(props: {
  bounds: BrowserAnnotationBounds;
  viewport: { width: number; height: number };
}) {
  return (
    <span
      aria-hidden="true"
      class="pointer-events-none absolute border-2 border-focus"
      style={{
        left: `${props.bounds.x / props.viewport.width * 100}%`,
        top: `${props.bounds.y / props.viewport.height * 100}%`,
        width: `${props.bounds.width / props.viewport.width * 100}%`,
        height: `${props.bounds.height / props.viewport.height * 100}%`,
      }}
    />
  );
}
