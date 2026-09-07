/** Light-DOM wrapper. The native button owns labels, events, and form behavior. */
export class DesignButton extends HTMLElement {
  connectedCallback() {
    this.querySelector(":scope > button")?.classList.add("ds-button");
  }
}

customElements.define("ds-button", DesignButton);
