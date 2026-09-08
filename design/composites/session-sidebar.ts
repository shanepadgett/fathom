import type { Chat, Project } from "../models/session.ts";

import { html } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { button } from "../primitives/button.ts";
import { iconButton } from "../primitives/icon-button.ts";
import { icon } from "../primitives/icon.ts";
import { projectSelector } from "../primitives/project-selector.ts";
import "./chat-list.ts";

export class SessionSidebarElement extends DesignElement {
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
    return html`
      <div data-component="session-sidebar">
        <div class="flex h-10 items-center gap-2 px-3">
          <div class="min-w-0 flex-1">
            ${button({
              label: "Search chats",
              content: html`${icon("magnifying-glass")}Search chats`,
              variant: "quiet",
              size: "small",
            })}
          </div>
          ${iconButton("note-pencil", "New chat")}
        </div>
        <div class="mx-2 mb-2">${projectSelector("All projects")}</div>
        <chat-list .chats=${chats} .projects=${projects} .selected=${selected}></chat-list>
      </div>
    `;
  }
}

customElements.define("session-sidebar", SessionSidebarElement);
