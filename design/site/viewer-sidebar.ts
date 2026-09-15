import { sidebarResizeBounds } from "../layouts/sidebar-sizing.ts";

const DEFAULT_SIDEBAR_WIDTH = 240;

export function viewerSidebarBounds() {
  const max = Math.max(1, Math.min(sidebarResizeBounds.max, innerWidth - 80));
  return { min: Math.min(sidebarResizeBounds.min, max), max };
}

/** Owns viewer navigation width, reveal behavior, and focus on open/close. */
export class ViewerSidebar {
  private sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
  private isCollapsed = false;
  constructor(
    private host: HTMLElement,
    signal: AbortSignal,
  ) {
    try {
      const saved = Number(localStorage.getItem("fathom-design-sidebar-width"));
      if (
        Number.isFinite(saved) &&
        saved >= sidebarResizeBounds.min &&
        saved <= sidebarResizeBounds.max
      ) {
        this.sidebarWidth = saved;
      }
    } catch {
      /* Optional persistence. */
    }

    this.host.addEventListener(
      "edge-resize",
      (event) => {
        if (
          !(event.target instanceof Element) ||
          !event.target.matches("[data-drawer-resizer]")
        ) {
          return;
        }
        this.sidebarWidth = (event as CustomEvent<number>).detail;
        this.updateLayout();
        try {
          localStorage.setItem(
            "fathom-design-sidebar-width",
            String(this.sidebarWidth),
          );
        } catch {
          /* Optional persistence. */
        }
      },
      { signal },
    );

    this.host.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("[data-drawer-toggle]")) {
          const collapsed =
            this.host.querySelector<HTMLElement>("[data-drawer]")!.hidden;
          this.setDrawer(!collapsed, true, (event as MouseEvent).detail === 0);
        }
      },
      { signal },
    );

    this.host.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          this.host.querySelector("[data-drawer]")!.contains(
            document.activeElement,
          )
        ) {
          this.setDrawer(true, true);
        }
      },
      { signal },
    );

    globalThis.addEventListener(
      "pointermove",
      (event) => {
        if (!this.isCollapsed || event.pointerType === "touch") return;
        const tab = this.host.querySelector<HTMLElement>("[data-drawer-open]")!;
        const nearEdge = event.clientX <= tab.offsetWidth * 2;
        const entering = nearEdge && !tab.hasAttribute("data-revealed");
        if (entering) tab.setAttribute("data-positioning", "");
        if (nearEdge) {
          // Pointer-derived placement is clamped to the viewport. This runtime
          // coordinate is intentionally not a fixed design dimension.
          const half = tab.offsetHeight / 2;
          tab.style.top = `${
            Math.max(half, Math.min(innerHeight - half, event.clientY))
          }px`;
        }
        if (entering) {
          // Commit the arrival position without vertical motion before revealing.
          tab.getBoundingClientRect();
          tab.removeAttribute("data-positioning");
        }
        tab.toggleAttribute("data-revealed", nearEdge);
      },
      { signal },
    );

    const hideEdgeTab = () => {
      this.host.querySelector("[data-drawer-open]")?.removeAttribute(
        "data-revealed",
      );
    };

    document.documentElement.addEventListener("pointerleave", hideEdgeTab, {
      signal,
    });

    globalThis.addEventListener("blur", hideEdgeTab, { signal });

    globalThis.addEventListener(
      "resize",
      () => {
        const tab = this.host.querySelector<HTMLElement>("[data-drawer-open]")!;
        tab.style.top = "";
        hideEdgeTab();
        this.updateLayout();
      },
      { signal },
    );

    this.setDrawer(matchMedia("(max-width: 48rem)").matches);
  }

  private updateLayout() {
    const isDesktop = matchMedia("(min-width: 48rem)").matches;
    const drawer = this.host.querySelector<HTMLElement>("[data-drawer]");
    const main = this.host.querySelector<HTMLElement>("[data-main]");
    if (drawer) {
      drawer.style.width = `${this.sidebarWidth}px`;
    }
    if (main) {
      main.style.marginLeft = !this.isCollapsed && isDesktop
        ? `${this.sidebarWidth}px`
        : "";
    }
  }

  setDrawer(collapsed: boolean, focus = false, keyboard = true) {
    this.isCollapsed = collapsed;
    const drawer = this.host.querySelector<HTMLElement>("[data-drawer]")!;
    const main = this.host.querySelector<HTMLElement>("[data-main]")!;
    const openToggle = this.host.querySelector<HTMLElement>(
      "[data-drawer-open]",
    )!;
    drawer.hidden = collapsed;
    openToggle.hidden = !collapsed;
    openToggle.removeAttribute("data-revealed");
    openToggle.style.top = "";
    main.classList.toggle("md:ml-60", !collapsed);
    this.updateLayout();
    for (const button of this.host.querySelectorAll("[data-drawer-toggle]")) {
      button.setAttribute("aria-expanded", String(!collapsed));
    }
    if (focus) {
      this.host
        .querySelector<HTMLElement>(
          collapsed
            ? (keyboard ? "[data-drawer-open] button" : "main")
            : "[data-brand] button",
        )!
        .focus({ preventScroll: true });
    }
  }
}
