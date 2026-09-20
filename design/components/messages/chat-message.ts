import type { Message, MessageBlock } from "../../models/conversation.ts";
import type { Changes } from "../../models/files.ts";

import { html, nothing, type TemplateResult } from "lit";

import "./message-attachments.ts";

import { DesignElement } from "../../foundation/design-element.ts";
import "../editor/change-summary.ts";
import "./message-header.ts";
import "../tools/tool-summary.ts";
import "../../primitives/button.ts";

import "../tools/tool-activity.ts";

const messageBlock = (
  block: MessageBlock,
  changes: Changes,
): TemplateResult => {
  switch (block.kind) {
    case "tool-summary":
      return html`<tool-summary .operations=${block.operations}></tool-summary>`;
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
      return html`
        <tool-activity
          .label=${block.label}
          .duration=${block.duration}
          .detail=${block.detail}
        ></tool-activity>
      `;
    case "changes":
      return html`
        <change-summary .changes=${changes}></change-summary>
      `;
    case "status":
      return html``;
  }
};

export class MessageElement extends DesignElement {
  static override properties = {
    item: { attribute: false },
    changes: { attribute: false },
    expanded: { state: true },
  };

  declare item: Message;
  declare changes: Changes;
  declare private expanded: boolean;

  constructor() {
    super();
    this.expanded = false;
  }

  override render() {
    if (!this.item) {
      return nothing;
    }
    if (!this.changes) {
      return nothing;
    }
    const { item, changes } = this;
    const collapsible = !item.agent && item.collapsible;
    return html`<article class="min-w-0 break-words">
      <message-header .message=${item}></message-header>
      <message-attachments .attachments=${
      item.attachments ?? []
    } .annotationCount=${item.annotationCount ?? 0}></message-attachments>
      <div class="space-y-4 ${
      collapsible && !this.expanded ? "message-preview-collapsed" : ""
    }">${item.blocks.map((block) => messageBlock(block, changes))}</div>
      ${
      collapsible
        ? html`
          <div class="mt-2">
            <ds-button variant="quiet"
              size="compact"><button type="button" aria-expanded=${this
                .expanded} @click=${() => {
                this.expanded = !this.expanded;
              }}>${this.expanded
                ? "Show less"
                : "Expand message"}</button></ds-button>
          </div>
        `
        : nothing
    }
    </article>`;
  }
}

customElements.define("chat-message", MessageElement);
