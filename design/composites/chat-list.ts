import type { Chat, Project } from "../models/session.ts";

import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { emptyState } from "../primitives/empty-state.ts";
import "./chat-list-item.ts";

export class ChatListElement extends DesignElement {
  static override properties = {
    chats: { attribute: false },
    projects: { attribute: false },
    selected: { type: String },
  };

  declare chats: Chat[];
  declare projects: Project[];
  declare selected: string;

  constructor() {
    super();
    this.chats = [];
    this.projects = [];
    this.selected = "";
  }

  override render() {
    const { chats, projects, selected } = this;
    return html`<div class="flex flex-col gap-1 px-2">
      ${
        chats.length
          ? chats.map(
              (chat) => html`
                <chat-list-item
                  .chat=${chat}
                  .project=${projects.find((project) => project.id === chat.projectId)!}
                  .selected=${chat.id === selected}
                ></chat-list-item>
              `,
            )
          : emptyState("No chats yet")
      }
    </div>`;
  }
}

customElements.define("chat-list", ChatListElement);
