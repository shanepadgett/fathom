import { DialogOverlay } from "./dialog-overlay.ts";
import { EdgeResizer } from "./edge-resizer.ts";

class DesignDrawer extends DialogOverlay {
  override connectedCallback() {
    super.connectedCallback();
    for (const handle of this.querySelectorAll<EdgeResizer>("edge-resizer")) {
      if (handle.closest("ds-drawer") !== this) continue;
      handle.bounds = () => {
        const available = this.getAttribute("mode") === "push"
          ? this.clientWidth
          : innerWidth;
        const max = Math.max(1, Math.min(1200, available - 80));
        return { min: Math.min(280, max), max };
      };
    }
    this.addEventListener("edge-resize", this.resizePanel);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("edge-resize", this.resizePanel);
  }

  private resizePanel = (event: Event) => {
    if (
      event.target instanceof EdgeResizer &&
      event.target.parentElement?.matches("[data-panel]") &&
      event.target.closest("ds-drawer") === this
    ) {
      this.style.setProperty(
        "--resized-panel-width",
        `${(event as CustomEvent<number>).detail}px`,
      );
    }
  };

  protected override onClick(event: MouseEvent) {
    if (!this.matches('[mode="push"]')) {
      super.onClick(event);
      return;
    }
    const target = event.target;
    if (
      !(target instanceof Element) ||
      target.closest("ds-modal, ds-drawer") !== this
    ) return;
    const panel = this.querySelector<HTMLElement>(":scope > [data-panel]");
    const trigger = this.querySelector<HTMLButtonElement>("[data-open]");
    if (!panel || !trigger || !target.closest("[data-open], [data-close]")) {
      return;
    }
    const open = !target.closest("[data-close]") && !this.hasAttribute("open");
    if (!open && panel.contains(document.activeElement)) trigger.focus();
    this.toggleAttribute("open", open);
    panel.inert = !open;
    trigger.setAttribute("aria-expanded", String(open));
  }
}

customElements.define("ds-drawer", DesignDrawer);
