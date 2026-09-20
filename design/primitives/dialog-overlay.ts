/** Shared native-dialog behavior; push panels belong to the drawer owner. */
export class DialogOverlay extends HTMLElement {
  private handleClick = (event: MouseEvent) => this.onClick(event);

  connectedCallback() {
    this.addEventListener("click", this.handleClick);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.handleClick);
    this.querySelector("dialog")?.close();
  }

  protected onClick(event: MouseEvent) {
    const target = event.target;
    if (
      !(target instanceof Element) ||
      target.closest("ds-modal, ds-drawer") !== this
    ) return;
    const dialog = this.querySelector<HTMLDialogElement>(":scope > dialog");
    if (!dialog) return;
    if (target.closest("[data-open]")) dialog.showModal();
    if (target.closest("[data-close]")) dialog.close();
  }
}
