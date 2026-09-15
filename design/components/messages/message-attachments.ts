import type { MessageAttachment } from "../../models/conversation.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { chip } from "../../primitives/chip.ts";
import { icon } from "../../primitives/icon.ts";

export class MessageAttachmentsElement extends DesignElement {
  static override properties = {
    attachments: { attribute: false },
    annotationCount: { type: Number },
  };

  declare attachments: MessageAttachment[];
  declare annotationCount: number;

  constructor() {
    super();
    this.attachments = [];
    this.annotationCount = 0;
  }

  override render() {
    const images = this.attachments.filter((attachment) => attachment.kind === "image");
    const files = this.attachments.filter((attachment) => attachment.kind === "file");
    return html`      ${images.length ? html`<ul class="mb-3 flex flex-wrap gap-3" aria-label="Image attachments">
        ${images.map((attachment) => html`<li class="h-24 w-24 overflow-hidden rounded-lg border border-control-line bg-surface" title=${attachment.name}>
          <img class="h-full w-full object-cover" src=${attachment.src} alt=${attachment.alt} />
        </li>`)}
      </ul>` : nothing}
      ${files.length || this.annotationCount ? html`<ul class="mb-4 flex flex-wrap gap-2" aria-label="Attached files and annotations">
        ${files.map((attachment) => html`<li class="min-w-0 max-w-full">${chip(html`${icon("file-text")}<span class="truncate">${attachment.name}</span>`, attachment.detail)}</li>`)}
        ${this.annotationCount ? html`<li>${chip(html`${icon("chat-circle-text")}${this.annotationCount} ${this.annotationCount === 1 ? "annotation" : "annotations"}`)}</li>` : nothing}
      </ul>` : nothing}
`;
  }
}

customElements.define("message-attachments", MessageAttachmentsElement);
