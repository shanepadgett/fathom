import type { Message } from "../../models/conversation.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";

export class MessageHeaderElement extends DesignElement {
  static override properties = {
    message: { attribute: false },
    animation: { type: String },
  };
  declare message: Message;
  declare animation?: string;

  constructor() {
    super();
    this.animation = "pages";
  }

  override render() {
    if (!this.message) {
      return nothing;
    }
    const { message } = this;
    const working =
      message.agent &&
      (message.working ??
        message.blocks.some((block) => block.kind === "status" && block.tone === "action"));
    return html`
      <header class="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 class="min-w-0 break-words font-semibold ${message.agent ? "text-action" : ""}">
          ${message.author}
        </h3>
        ${
          working
            ? html`<span class="sr-only">Working</span>${
                  this.animation
                    ? html`
                        <span
                          class="identity-motion identity-motion-${this.animation}"
                          aria-hidden="true"
                          ><i></i><i></i><i></i><i></i
                        ></span>
                      `
                    : nothing
                }`
            : nothing
        }
        ${message.model ? html`<span class="text-sm text-muted">${message.model}</span>` : nothing}
        ${!working ? html`<span class="text-sm text-muted">${message.time}</span>` : nothing}
        ${message.edited ? html`<span class="text-sm text-muted">Edited</span>` : nothing}
      </header>
    `;
  }
}

customElements.define("message-header", MessageHeaderElement);
