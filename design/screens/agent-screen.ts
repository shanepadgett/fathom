import { systemStatus } from "../fixtures/system-status.ts";
import { html, nothing } from "lit";

import { ContextMenuElement } from "../components/context-menu.ts";
import { conversationMenu, threadMenu } from "../fixtures/context-menus.ts";
import { DesignElement } from "../components/design-element.ts";
import "../composites/chat-search.ts";
import "../composites/conversation-pane.ts";
import "../composites/diff-pane.ts";
import "../composites/project-picker.ts";
import "../composites/new-session.ts";
import "../composites/session-inspector.ts";
import "../composites/session-sidebar.ts";
import "../composites/workspace-header.ts";
import "../composites/workspace-status-bar.ts";
import { diffLines } from "../fixtures/diff.ts";
import { pinnedProjects, pinnedSessions, pinnedSessionIds } from "../fixtures/pinned-sessions.ts";
import { scenario } from "../fixtures/workspace-scenario.ts";
import "../layouts/workspace-body.ts";
import "../layouts/workspace-drawer.ts";
import "../layouts/workspace-layout.ts";
import "../layouts/workspace-overlay.ts";
import "../layouts/workspace-scrim.ts";
import "../layouts/workspace-shell.ts";
import "../layouts/workspace-sidebar.ts";

/** Static states of one screen, not routes or application state. */
export type AgentScreenState = "base" | "new-session" | "context-breakdown" | "no-session" | "diff" | "projects" | "chat-search" | "context-menus";

export class AgentScreen extends DesignElement {
  static override properties = { state: { type: String } };

  declare state: AgentScreenState;

  constructor() {
    super();
    this.state = "base";
  }

  private openMenu(event: MouseEvent | KeyboardEvent) {
    const target = event.target as HTMLElement;
    const thread = target.closest<HTMLElement>("[data-chat-item]");
    const options = target.closest<HTMLElement>('button[aria-label="Conversation options"]');
    const keyboard = event instanceof KeyboardEvent && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"));
    if (thread && (event.type === "contextmenu" || keyboard)) {
      event.preventDefault();
      this.querySelector<ContextMenuElement>('[data-thread-menu]')?.open(thread);
    } else if (options && event.type === "click") {
      this.querySelector<ContextMenuElement>('[data-conversation-menu]')?.open(options);
    }
  }

  override render() {
    return html`
      <workspace-shell>
        <workspace-layout @contextmenu=${this.openMenu} @click=${this.openMenu} @keydown=${this.openMenu}>
          <workspace-header mode="agent"></workspace-header>

          <workspace-body>
            <workspace-sidebar placement="chats" role="complementary" aria-label="Project sessions">
              <session-sidebar
                .pinned=${pinnedSessionIds}
                .chats=${pinnedSessions}
                .projects=${pinnedProjects}
                .selected=${scenario.selectedChat.id}
              ></session-sidebar>
            </workspace-sidebar>

            <conversation-pane
              .title=${scenario.selectedChat.title}
              .messages=${scenario.messages}
              .changes=${scenario.changes}
              .model=${scenario.model}
              .reasoning=${scenario.reasoning}
            ></conversation-pane>

            ${
              this.state === "no-session"
                ? nothing
                : html`
                    <workspace-sidebar
                      placement="inspector"
                      role="complementary"
                      aria-label="Session inspector"
                    >
                      <session-inspector .data=${scenario.inspector}></session-inspector>
                    </workspace-sidebar>
                  `
            }
          </workspace-body>

          <div class=${this.state === "context-menus" ? "absolute left-8 top-40 z-10" : "contents"}>
            <ds-context-menu data-thread-menu .sections=${threadMenu} label="Thread options" .preview=${this.state === "context-menus"}></ds-context-menu>
          </div>
          <div class=${this.state === "context-menus" ? "absolute right-64 top-28 z-10" : "contents"}>
            <ds-context-menu data-conversation-menu .sections=${conversationMenu} label="Conversation options" .preview=${this.state === "context-menus"}></ds-context-menu>
          </div>

          <workspace-status-bar
            .system=${systemStatus}
            .context=${scenario.context}
            .contextOpen=${this.state === "context-breakdown"}
          ></workspace-status-bar>

          ${
            this.state === "diff"
              ? html`
                  <workspace-scrim>
                    <workspace-drawer kind="diff" role="region" aria-label="File diff overlay">
                      <diff-pane
                        .path=${scenario.path}
                        .lines=${diffLines}
                        .count=${scenario.changes.count}
                        .added=${scenario.selectedDiff.added}
                        .removed=${scenario.selectedDiff.removed}
                        .drawer=${true}
                      ></diff-pane>
                    </workspace-drawer>
                  </workspace-scrim>
                `
              : nothing
          }
          ${this.state === "new-session" ? html`
            <workspace-overlay aria-label="New session overlay">
              <new-session .projects=${pinnedProjects}></new-session>
            </workspace-overlay>
          ` : nothing}
          ${
            this.state === "projects"
              ? html`
                  <div class="absolute left-2 top-32 z-20" aria-label="Project picker overlay">
                    <project-picker .projects=${pinnedProjects}></project-picker>
                  </div>
                `
              : nothing
          }
          ${
            this.state === "chat-search"
              ? html`
                  <workspace-overlay aria-label="Chat search overlay">
                    <chat-search
                      .chats=${scenario.searchChats}
                      .projects=${pinnedProjects}
                    ></chat-search>
                  </workspace-overlay>
                `
              : nothing
          }
        </workspace-layout>
      </workspace-shell>
    `;
  }
}

customElements.define("agent-screen", AgentScreen);
