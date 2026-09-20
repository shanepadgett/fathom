import { LitElement } from "lit";

/** Shared light DOM keeps the reference's tokens and utilities in one place. */
export class DesignElement extends LitElement {
  override connectedCallback() {
    super.connectedCallback();
    this.classList.add("design-element");
  }

  protected override createRenderRoot() {
    return this;
  }
}
