/** Supply a trigger with data-open and a native dialog containing your content. */
class DesignOverlay extends HTMLElement {
  connectedCallback() {
    this.addEventListener("click", this.onClick);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.onClick);
    this.querySelector("dialog")?.close();
  }

  private onClick = (event: MouseEvent) => {
    const target = event.target;
    if (
      !(target instanceof Element) ||
      target.closest("ds-modal, ds-drawer") !== this
    ) return;
    if (this.matches('ds-drawer[mode="push"]')) {
      const panel = this.querySelector<HTMLElement>(":scope > [data-panel]");
      const trigger = this.querySelector<HTMLButtonElement>("[data-open]");
      if (!panel || !trigger) return;
      if (!target.closest("[data-open], [data-close]")) return;
      const open = !target.closest("[data-close]") &&
        !this.hasAttribute("open");
      if (!open && panel.contains(document.activeElement)) trigger.focus();
      this.toggleAttribute("open", open);
      panel.inert = !open;
      trigger.setAttribute("aria-expanded", String(open));
      return;
    }
    const dialog = this.querySelector<HTMLDialogElement>(":scope > dialog");
    if (!dialog) return;
    if (target.closest("[data-open]")) dialog.showModal();
    if (target.closest("[data-close]")) dialog.close();
  };
}

customElements.define("ds-modal", class extends DesignOverlay {});
customElements.define("ds-drawer", class extends DesignOverlay {});
