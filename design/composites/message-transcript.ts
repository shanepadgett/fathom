import type { Message } from "../models/conversation.ts";
import type { Changes } from "../models/files.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";
import "./chat-message.ts";

export class TranscriptElement extends DesignElement {
  static override properties = {
    messages: { attribute: false },
    changes: { attribute: false },
  };

  declare messages: Message[];
  declare changes: Changes;

  constructor() {
    super();
    this.messages = [];
  }

  override render() {
    if (!this.changes) {
      return nothing;
    }
    const { messages, changes } = this;
    return html`
      <div
        data-component="transcript"
        class="mx-auto w-full max-w-transcript flex flex-col gap-8 px-6 py-8"
      >
        ${messages.map(
          (item) => html`<chat-message .item=${item} .changes=${changes}></chat-message>`,
        )}
      </div>
    `;
  }
}

customElements.define("message-transcript", TranscriptElement);
