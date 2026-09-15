import type { Chat, Project } from "../../models/session.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";
import "./chat-metadata.ts";
import { resultFrame } from "./search-result-frame.ts";

export class ChatSearchResultElement extends DesignElement {
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
    return resultFrame(
      html`<span class="text-muted">${
        icon("chat-circle-text", "large")
      }</span>`,
      html`
        <p class="truncate text-sm" title="${chat.title}">${chat.title}</p>
        <div class="mt-1 text-xs text-muted">
          <chat-metadata .project=${project.name} .branch=${chat
            .branch}></chat-metadata>
        </div>
      `,
      chat.time,
      selected,
    );
  }
}

customElements.define("chat-search-result", ChatSearchResultElement);
