import { createSignal, onCleanup, type JSX } from "solid-js";

const MIN_WIDTH = 180;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 240;
const KEYBOARD_STEP = 16;
const KEYBOARD_PAGE_STEP = 48;

interface Drag {
  handle: HTMLElement;
  pointerId: number;
  startX: number;
  startWidth: number;
  cursor: string;
  selection: string;
  frames: Array<readonly [HTMLIFrameElement, string]>;
}

/** Reference edge-resizer: pointer drag, arrow keys, Home/End, double-click reset. */
export function ResizableSidebar(props: {
  label: string;
  side?: "left" | "right";
  children: JSX.Element;
}): JSX.Element {
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);
  const [dragging, setDragging] = createSignal(false);
  const left = () => props.side === "right";
  let drag: Drag | undefined;

  const clamp = (value: number) =>
    Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value)));

  const finish = () => {
    if (!drag) {
      return;
    }

    for (const [frame, value] of drag.frames) {
      frame.style.pointerEvents = value;
    }

    document.body.style.cursor = drag.cursor;
    document.body.style.userSelect = drag.selection;

    if (drag.handle.hasPointerCapture(drag.pointerId)) {
      drag.handle.releasePointerCapture(drag.pointerId);
    }

    drag = undefined;
    setDragging(false);
    removeEventListener("blur", finish);
  };

  onCleanup(finish);

  return (
    <aside
      class="fathom-sidebar"
      aria-label={props.label}
      style={{ width: `${width()}px` }}
      data-side={props.side ?? "left"}
    >
      <div class="min-h-0 flex-1 overflow-y-auto">{props.children}</div>
      <div
        class="fathom-resizer"
        role="separator"
        tabindex="0"
        aria-label={`Resize ${props.label}`}
        aria-orientation="vertical"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={width()}
        title="Drag to resize; use arrow keys; double-click to reset"
        data-dragging={dragging() ? "" : undefined}
        onDblClick={() => setWidth(DEFAULT_WIDTH)}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary || drag) {
            return;
          }

          event.preventDefault();

          const cursor = document.body.style.cursor;
          const selection = document.body.style.userSelect;

          const frames = [...document.querySelectorAll("iframe")].map(
            (frame) => [frame, frame.style.pointerEvents] as const,
          );

          for (const [frame] of frames) {
            frame.style.pointerEvents = "none";
          }

          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";

          drag = {
            handle: event.currentTarget,
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidth: width(),
            cursor,
            selection,
            frames,
          };

          event.currentTarget.setPointerCapture(event.pointerId);
          addEventListener("blur", finish);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (drag) {
            setWidth(
              clamp(
                drag.startWidth +
                  (event.clientX - drag.startX) * (left() ? -1 : 1),
              ),
            );
          }
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onKeyDown={(event) => {
          const step = event.shiftKey ? KEYBOARD_PAGE_STEP : KEYBOARD_STEP;
          const direction = left() ? -1 : 1;

          const target = {
            ArrowLeft: width() - step * direction,
            ArrowRight: width() + step * direction,
            Home: MIN_WIDTH,
            End: MAX_WIDTH,
            Enter: DEFAULT_WIDTH,
            " ": DEFAULT_WIDTH,
          }[event.key];

          if (target !== undefined) {
            event.preventDefault();
            setWidth(clamp(target));
          }
        }}
      />
    </aside>
  );
}
