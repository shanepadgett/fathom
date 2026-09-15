/** Serialized into the opaque-origin preview. Keep all dependencies inside it. */
export function installPicker(channel: string, hostOrigin: string) {
  let mode: "element" | "area" | undefined;
  let color = "currentColor";
  let overlay: HTMLDivElement | undefined;
  let drag: { x: number; y: number; pointer: number } | undefined;
  let suppressClick = false;
  const hide = () => {
    if (overlay) overlay.style.display = "none";
  };
  const resetDrag = () => {
    if (drag && document.documentElement.hasPointerCapture(drag.pointer)) {
      document.documentElement.releasePointerCapture(drag.pointer);
    }
    drag = undefined;
    hide();
  };
  const cancel = () => {
    mode = undefined;
    resetDrag();
    parent.postMessage({ channel, kind: "cancel" }, hostOrigin);
  };
  const point = (event: PointerEvent) => ({
    x: Math.max(0, Math.min(innerWidth, event.clientX)),
    y: Math.max(0, Math.min(innerHeight, event.clientY)),
  });
  const area = (event: PointerEvent) => {
    const end = point(event);
    return {
      x: Math.min(drag!.x, end.x),
      y: Math.min(drag!.y, end.y),
      width: Math.abs(end.x - drag!.x),
      height: Math.abs(end.y - drag!.y),
    };
  };
  const show = (
    rect: { x: number; y: number; width: number; height: number },
  ) => {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid;box-sizing:border-box";
      document.body.append(overlay);
    }
    Object.assign(overlay.style, {
      borderColor: color,
      display: "block",
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  };
  const send = (
    kind: "element" | "area",
    element: Element,
    rect: { x: number; y: number; width: number; height: number },
  ) => {
    const hierarchy: string[] = [];
    let node: Element | null = element;
    while (node && hierarchy.length < 6) {
      hierarchy.unshift(
        node.tagName.toLowerCase() +
          (node.id ? `#${CSS.escape(node.id)}` : "") +
          [...node.classList].slice(0, 4).map((name) => `.${CSS.escape(name)}`)
            .join(""),
      );
      node = node.parentElement;
    }
    parent.postMessage({
      channel,
      kind,
      selector: hierarchy.join(" > ").slice(0, 1200),
      text: (element.textContent ?? "").trim().slice(0, 2000),
      bounds: {
        x: Math.round(rect.x + scrollX),
        y: Math.round(rect.y + scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    }, hostOrigin);
    mode = undefined;
    resetDrag();
  };
  window.addEventListener("message", (event) => {
    if (
      event.source !== parent || event.origin !== hostOrigin ||
      event.data?.channel !== channel
    ) return;
    mode = event.data.mode === "element" || event.data.mode === "area"
      ? event.data.mode
      : undefined;
    resetDrag();
    if (typeof event.data.color === "string") color = event.data.color;
  });
  window.addEventListener("pointermove", (event) => {
    if (!mode || !(event.target instanceof Element)) return;
    if (mode === "element") show(event.target.getBoundingClientRect());
    else if (drag) show(area(event));
  }, true);
  window.addEventListener("pointerdown", (event) => {
    if (!mode) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (mode === "area" && event.button === 0 && !drag) {
      drag = { ...point(event), pointer: event.pointerId };
      document.documentElement.setPointerCapture(event.pointerId);
    }
  }, true);
  window.addEventListener("pointerup", (event) => {
    if (!mode) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (mode !== "area" || !drag || drag.pointer !== event.pointerId) return;
    const rect = area(event);
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 0);
    if (rect.width < 2 || rect.height < 2) {
      resetDrag();
      return;
    }
    const element = document.elementFromPoint(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
    ) ?? document.body;
    send("area", element, rect);
  }, true);
  for (const name of ["mousedown", "mouseup"]) {
    window.addEventListener(name, (event) => {
      if (mode || suppressClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }
  window.addEventListener("click", (event) => {
    if (!mode && !suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (mode === "element" && event.target instanceof Element) {
      send("element", event.target, event.target.getBoundingClientRect());
    }
  }, true);
  window.addEventListener("keydown", (event) => {
    if (mode && event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      cancel();
    }
  }, true);
  window.addEventListener("pointercancel", () => {
    if (drag) cancel();
  }, true);
  window.addEventListener("scroll", resetDrag, true);
}
