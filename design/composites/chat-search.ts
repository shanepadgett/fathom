import type { Chat, Project } from "../models/session.ts";

import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { emptyState } from "../primitives/empty-state.ts";
import { searchFieldPreview } from "../primitives/search-field-preview.ts";
import "./chat-search-result.ts";
import "./search-surface.ts";

export class ChatSearchElement extends DesignElement {
  static override properties = {
    chats: { attribute: false },
    projects: { attribute: false },
  };

  declare chats: Chat[];
  declare projects: Project[];

  constructor() {
    super();
    this.chats = [];
    this.projects = [];
  }

  override render() {
    const { chats, projects } = this;
    return html`
      <search-surface
        .label=${"Search sessions"}
        .heading=${"Recent sessions"}
        .field=${searchFieldPreview("Search sessions\u2026", true, "All projects")}
        .results=${
          chats.length
            ? chats.map(
                (chat, index) => html`
                  <chat-search-result
                    .chat=${chat}
                    .project=${projects.find((project) => project.id === chat.projectId)!}
                    .selected=${index === 0}
                  ></chat-search-result>
                `,
              )
            : emptyState("No sessions found")
        }
        .action=${"Open session"}
      ></search-surface>
    `;
  }
}

customElements.define("chat-search", ChatSearchElement);
