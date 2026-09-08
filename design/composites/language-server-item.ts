import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";

export class LanguageServerItemElement extends DesignElement {
  static override properties = { name: { type: String } };
  declare name: string;

  constructor() {
    super();
    this.name = "";
  }

  override render() {
    const { name } = this;
    return html`
      <p class="flex justify-between gap-3">${name}<span class="text-success">Connected</span></p>
    `;
  }
}

customElements.define("language-server-item", LanguageServerItemElement);
