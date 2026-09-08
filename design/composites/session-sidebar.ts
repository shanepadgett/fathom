import type { Chat, Project } from "../models/session.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { button } from "../primitives/button.ts";
import { iconButton } from "../primitives/icon-button.ts";
import { icon } from "../primitives/icon.ts";
import { projectSelector } from "../primitives/project-selector.ts";
import "./chat-list.ts";

export class SessionSidebarElement extends DesignElement {
  static override properties = {
    mode: { type: String },
    chats: { attribute: false },
    projects: { attribute: false },
    selected: { type: String },
    pinned: { attribute: false },
  };

  declare chats: Chat[];
  declare projects: Project[];
  declare mode: "agent" | "chat";
  declare selected: string;
  declare pinned: string[];

  constructor() {
    super();
    this.chats = [];
    this.projects = [];
    this.mode = "agent";
    this.selected = "";
    this.pinned = [];
  }

  private readonly updateScrollState = () => {
    this.toggleAttribute("data-scrolled", this.scrollTop > 0);
  };

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener("scroll", this.updateScrollState, { passive: true });
  }

  override disconnectedCallback() {
    this.removeEventListener("scroll", this.updateScrollState);
    super.disconnectedCallback();
  }

  override render() {
    const { chats, projects, selected } = this;
    const pinnedChats = chats.filter((chat) => this.pinned.includes(chat.id));
    const recentChats = chats.filter((chat) => !this.pinned.includes(chat.id));
    return html`
      <div data-component="session-sidebar">
        <div class="session-sidebar-controls sticky top-0 z-10 flow-root bg-surface">
        <div class="flex h-10 items-center gap-2 px-3">
          <div class="min-w-0 flex-1">
            ${button({
              label: this.mode === "agent" ? "Search sessions" : "Search chats",
              content: html`${icon("magnifying-glass")}${this.mode === "agent" ? "Search sessions" : "Search chats"}`,
              variant: "quiet",
              size: "small",
            })}
          </div>
          ${iconButton("note-pencil", this.mode === "agent" ? "New session" : "New chat")}
        </div>
        ${this.mode === "chat" ? nothing : html`<div class="mx-2 mb-2">${projectSelector("All projects")}</div>`}
        </div>
        ${pinnedChats.length ? html`
          <section aria-label=${this.mode === "agent" ? "Pinned sessions" : "Pinned chats"} class="mb-4">
            <h3 class="session-sidebar-heading flex items-center gap-2 px-4 py-2 text-center text-dense font-medium text-ink">${this.mode === "agent" ? "Pinned sessions" : "Pinned chats"}</h3>
            <chat-list .mode=${this.mode} .chats=${pinnedChats} .projects=${projects} .selected=${selected}></chat-list>
          </section>
          <h3 class="session-sidebar-heading flex items-center gap-2 px-4 py-2 text-center text-dense font-medium text-ink">Recent</h3>
        ` : nothing}
        <chat-list .mode=${this.mode} .chats=${recentChats} .projects=${projects} .selected=${selected}></chat-list>
      </div>
    `;
  }
}

customElements.define("session-sidebar", SessionSidebarElement);
