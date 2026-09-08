import type { Message } from "../models/conversation.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";

export class MessageHeaderElement extends DesignElement {
  static override properties = { message: { attribute: false } };
  declare message: Message;

  override render() {
    if (!this.message) {
      return nothing;
    }
    const { message } = this;
    return html`
      <header class="mb-3 flex items-center gap-3">
        <h3 class="font-semibold ${message.agent ? "text-action" : ""}">${message.author}</h3>
        <span class="text-sm text-muted">${message.time}</span>
      </header>
    `;
  }
}

customElements.define("message-header", MessageHeaderElement);
