import type { Message, MessageBlock } from "../models/conversation.ts";
import type { Changes } from "../models/files.ts";

import { html, nothing, type TemplateResult } from "lit";

import { icon } from "../primitives/icon.ts";

import { DesignElement } from "../components/design-element.ts";
import "./change-summary.ts";
import "./message-header.ts";
import "./tool-summary.ts";
import "../components/button.ts";

import "./tool-activity.ts";

const messageBlock = (block: MessageBlock, changes: Changes): TemplateResult => {
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
      return html`<tool-activity
        .label=${block.label}
        .duration=${block.duration}
        .detail=${block.detail}
      ></tool-activity>`;
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
    const images = item.attachments?.filter((attachment) => attachment.kind === "image") ?? [];
    const files = item.attachments?.filter((attachment) => attachment.kind === "file") ?? [];
    const collapsible = !item.agent && item.collapsible;
    return html`<article class="min-w-0 break-words">
      <message-header .message=${item}></message-header>
      ${images.length ? html`<ul class="mb-3 flex flex-wrap gap-3" aria-label="Image attachments">
        ${images.map((attachment) => html`<li class="h-24 w-24 overflow-hidden rounded-lg border border-control-line bg-surface" title=${attachment.name}>
          <img class="h-full w-full object-cover" src=${attachment.src} alt=${attachment.alt} />
        </li>`)}
      </ul>` : nothing}
      ${files.length || item.annotationCount ? html`<ul class="mb-4 flex flex-wrap gap-2" aria-label="Attached files and annotations">
        ${files.map((attachment) => html`<li class="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-control-line bg-surface px-3 py-2 text-sm" title=${attachment.detail}>
          ${icon("file-text")}<span class="truncate">${attachment.name}</span>
        </li>`)}
        ${item.annotationCount ? html`<li class="inline-flex items-center gap-2 rounded-full border border-control-line bg-surface px-3 py-2 text-sm">${icon("chat-circle-text")}${item.annotationCount} ${item.annotationCount === 1 ? "annotation" : "annotations"}</li>` : nothing}
      </ul>` : nothing}
      <div class="space-y-4 ${collapsible && !this.expanded ? "message-preview-collapsed" : ""}">${item.blocks.map((block) =>
        messageBlock(block, changes),
      )}</div>
      ${collapsible ? html`<div class="mt-2">
        <ds-button variant="quiet" size="compact"><button type="button" aria-expanded=${this.expanded} @click=${() => { this.expanded = !this.expanded; }}>${this.expanded ? "Show less" : "Expand message"}</button></ds-button>
      </div>` : nothing}
    </article>`;
  }
}

customElements.define("chat-message", MessageElement);
