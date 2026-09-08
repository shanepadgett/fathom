import type { Chat, Project } from "../models/session.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { statusDot } from "../primitives/status-dot.ts";
import "./branch-identity.ts";
import "./project-identity.ts";

export class ChatListItemElement extends DesignElement {
  static override properties = {
    chat: { attribute: false },
    project: { attribute: false },
    selected: { type: Boolean },
  };

  declare chat: Chat;
  declare project: Project;
  declare selected: boolean;

  constructor() {
    super();
    this.selected = false;
  }

  override render() {
    if (!this.chat) {
      return nothing;
    }
    if (!this.project) {
      return nothing;
    }
    const { chat, project, selected } = this;
    return html`
      <div
        data-chat-item
        class="min-w-0 rounded-control px-2 py-2 ${selected ? "bg-action/10" : "hover:bg-canvas"}"
        aria-current=${selected ? "true" : nothing}
      >
        <div class="flex items-center justify-between gap-1.5 text-micro text-muted">
          <project-identity .name=${project.name}></project-identity
          ><span class="shrink-0">${chat.time}</span>
        </div>
        <p
          class="mt-1 truncate text-dense ${selected ? "text-action" : "text-ink"}"
          title="${chat.title}"
        >
          ${chat.title}
        </p>
        <div class="mt-1 flex min-w-0 items-center justify-between gap-1.5 text-micro text-muted">
          <branch-identity .branch=${chat.branch}></branch-identity>${
            chat.status ? statusDot("action", chat.status, true) : ""
          }
        </div>
      </div>
    `;
  }
}

customElements.define("chat-list-item", ChatListItemElement);
