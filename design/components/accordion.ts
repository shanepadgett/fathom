/** Native details provide keyboard behavior; name scopes single-open groups. */
class DesignAccordion extends HTMLElement {
  private group = `accordion-${crypto.randomUUID()}`;

  static observedAttributes = ["multiple"];

  connectedCallback() {
    this.sync();
  }

  attributeChangedCallback() {
    this.sync();
  }

  private sync() {
    for (const item of this.querySelectorAll(":scope > details")) {
      if (this.hasAttribute("multiple")) item.removeAttribute("name");
      else item.setAttribute("name", this.group);
    }
  }
}

customElements.define("ds-accordion", DesignAccordion);
