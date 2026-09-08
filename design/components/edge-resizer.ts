export const sidebarResizeBounds = { min: 180, max: 560 };
/** Shared edge handle for sidebar and drawer preview sizing. */
class EdgeResizer extends HTMLElement {
  private events?: AbortController;
  private observer?: ResizeObserver;
  private finish?: () => void;

  connectedCallback() {
    this.events?.abort();
    this.events = new AbortController();
    const { signal } = this.events;
    const panel = this.parentElement!;
    const left = this.getAttribute("edge") === "left";
    const drawer = panel.matches("section, dialog, [data-panel]");
    let defaultWidth = 0;
    const bounds = () => {
      const workspace = panel.closest<HTMLElement>("[data-workspace]");
      let available = workspace?.clientWidth ??
        (panel.matches("[data-panel]")
          ? panel.parentElement!.clientWidth
          : innerWidth);
      if (workspace && panel.matches("aside:not([data-panel])")) {
        const siblings = panel.parentElement!.querySelectorAll<HTMLElement>(
          ":scope > aside",
        );
        for (const sibling of siblings) {
          if (sibling !== panel) {
            available -= sibling.getBoundingClientRect().width;
          }
        }
        available -= 320;
      } else available -= 80;
      const max = Math.max(
        1,
        Math.min(drawer ? 1200 : sidebarResizeBounds.max, available),
      );
      return {
        min: Math.min(drawer ? 280 : sidebarResizeBounds.min, max),
        max,
      };
    };
    const sync = () => {
      const width = panel.getBoundingClientRect().width;
      if (!defaultWidth && width > 0) defaultWidth = width;
      const { min, max } = bounds();
      this.setAttribute("aria-valuemin", String(Math.round(min)));
      this.setAttribute("aria-valuemax", String(Math.round(max)));
      this.setAttribute("aria-valuenow", String(Math.round(width)));
    };
    const setWidth = (width: number) => {
      const { min, max } = bounds();
      const value = Math.round(Math.max(min, Math.min(max, width)));
      panel.style.width = `${value}px`;
      if (panel.matches("[data-panel]")) {
        panel.parentElement!.style.setProperty(
          "--resized-panel-width",
          `${value}px`,
        );
      }
      sync();
      this.dispatchEvent(
        new CustomEvent("edge-resize", { detail: value, bubbles: true }),
      );
    };
    this.tabIndex = 0;
    this.setAttribute("role", "separator");
    this.setAttribute("aria-orientation", "vertical");
    this.setAttribute(
      "aria-label",
      `Resize ${panel.getAttribute("aria-label") ?? "drawer"}`,
    );
    this.title = "Drag to resize; use arrow keys; double-click to reset";
    this.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      this.finish?.();
      const start = event.clientX;
      const width = panel.getBoundingClientRect().width;
      if (!panel.style.width) defaultWidth = width;
      const cursor = document.body.style.cursor;
      const selection = document.body.style.userSelect;
      const drag = new AbortController();
      const frames = [...document.querySelectorAll("iframe")].map((frame) =>
        [frame, frame.style.pointerEvents] as const
      );
      for (const [frame] of frames) frame.style.pointerEvents = "none";
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      this.setAttribute("dragging", "");
      this.setPointerCapture(event.pointerId);
      this.finish = () => {
        drag.abort();
        this.removeAttribute("dragging");
        for (const [frame, value] of frames) frame.style.pointerEvents = value;
        document.body.style.cursor = cursor;
        document.body.style.userSelect = selection;
        if (this.hasPointerCapture(event.pointerId)) {
          this.releasePointerCapture(event.pointerId);
        }
        this.finish = undefined;
      };
      this.addEventListener("pointermove", (move) => {
        setWidth(width + (move.clientX - start) * (left ? -1 : 1));
      }, { signal: drag.signal });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
        this.addEventListener(type, () => this.finish?.(), {
          signal: drag.signal,
        });
      }
      globalThis.addEventListener("blur", () => this.finish?.(), {
        signal: drag.signal,
      });
    }, { signal });
    this.addEventListener("dblclick", () => setWidth(defaultWidth), { signal });
    this.addEventListener("keydown", (event) => {
      const { min, max } = bounds();
      const width = panel.getBoundingClientRect().width;
      if (!panel.style.width) defaultWidth = width;
      const step = event.shiftKey ? 48 : 16;
      const values: Record<string, number> = {
        ArrowLeft: width + (left ? step : -step),
        ArrowRight: width + (left ? -step : step),
        Home: min,
        End: max,
        Enter: defaultWidth,
        " ": defaultWidth,
      };
      if (event.key in values) {
        event.preventDefault();
        setWidth(values[event.key]);
      }
    }, { signal });
    this.observer = new ResizeObserver(sync);
    this.observer.observe(panel);
    globalThis.addEventListener("resize", () => {
      if (panel.style.width) setWidth(panel.getBoundingClientRect().width);
      else sync();
    }, { signal });
    sync();
  }

  disconnectedCallback() {
    this.finish?.();
    this.events?.abort();
    this.observer?.disconnect();
  }
}
customElements.define("edge-resizer", EdgeResizer);
