import type { Message, MessageBlock } from "../models/conversation.ts";
import type { Changes } from "../models/files.ts";

import { html, nothing, type TemplateResult } from "lit";

import { DesignElement } from "../components/design-element.ts";
import "./change-summary.ts";
import "./message-header.ts";
import "./run-status.ts";
import "./tool-activity.ts";

const messageBlock = (block: MessageBlock, changes: Changes): TemplateResult => {
  switch (block.kind) {
    case "prose":
      return html`<p>${block.text}</p>`;
    case "tool":
      return html`
        <tool-activity
          .label=${block.label}
          .duration=${block.duration}
          .files=${block.files}
        ></tool-activity>
      `;
    case "research":
      return html`<tool-activity
        .label=${block.label}
        .duration=${block.duration}
        .detail=${block.detail}
      ></tool-activity>`;
    case "changes":
      return html`
        <change-summary .changes=${changes} .description=${block.description}></change-summary>
      `;
    case "status":
      return html`
        <div class="mt-6 text-sm text-muted">
          <run-status .label=${block.text} .tone=${block.tone}></run-status>
        </div>
      `;
  }
};

export class MessageElement extends DesignElement {
  static override properties = {
    item: { attribute: false },
    changes: { attribute: false },
  };

  declare item: Message;
  declare changes: Changes;

  override render() {
    if (!this.item) {
      return nothing;
    }
    if (!this.changes) {
      return nothing;
    }
    const { item, changes } = this;
    return html`<article>
      <message-header .message=${item}></message-header>${item.blocks.map((block) =>
        messageBlock(block, changes),
      )}
    </article>`;
  }
}

customElements.define("chat-message", MessageElement);
