import { html, nothing } from "lit";

import "../primitives/context-menu.ts";
import { DesignElement } from "../foundation/design-element.ts";
import { conversationMenu, threadMenu } from "../fixtures/context-menus.ts";
import { diffLines } from "../fixtures/diff.ts";
import "../components/navigation/chat-search.ts";
import "../components/messages/conversation-pane.ts";
import "../components/editor/diff-pane.ts";
import "../components/navigation/project-picker.ts";
import "../components/navigation/new-session.ts";
import "../components/workspace/session-inspector.ts";
import "../components/navigation/session-sidebar.ts";
import "../components/workspace/workspace-header.ts";
import "../components/workspace/workspace-status-bar.ts";
import {
  pinnedProjects,
  pinnedSessionIds,
  pinnedSessions,
} from "../fixtures/pinned-sessions.ts";
import { systemStatus } from "../fixtures/system-status.ts";
import { scenario } from "../fixtures/workspace-scenario.ts";
import "../layouts/workspace-drawer.ts";
import "../layouts/workspace-layout.ts";
import "../layouts/workspace-sidebar.ts";

/** Static states of one screen, not routes or application state. */
export type AgentScreenState =
  | "base"
  | "new-session"
  | "context-breakdown"
  | "inspector-closed"
  | "diff"
  | "projects"
  | "chat-search"
  | "context-menus";

export class AgentScreen extends DesignElement {
  static override properties = { state: { type: String } };

  declare state: AgentScreenState;

  constructor() {
    super();
    this.state = "base";
  }

  override render() {
    return html`
      <div class="workspace-shell">
        <workspace-layout>
          <workspace-header mode="agent"></workspace-header>

          <div class="workspace-body">
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

            ${this.state === "inspector-closed" ? nothing : html`
              <workspace-sidebar
                placement="inspector"
                role="complementary"
                aria-label="Session inspector"
              >
                <session-inspector .data=${scenario
                  .inspector}></session-inspector>
              </workspace-sidebar>
            `}
          </div>

          ${this.state === "context-menus"
            ? html`
              <div class="absolute left-8 top-40 z-10">
                <ds-context-menu
                  .sections=${threadMenu}
                  label="Thread options"
                  preview
                ></ds-context-menu>
              </div>
              <div class="absolute right-64 top-28 z-10">
                <ds-context-menu
                  .sections=${conversationMenu}
                  label="Conversation options"
                  preview
                ></ds-context-menu>
              </div>
            `
            : nothing}

          <workspace-status-bar
            .system=${systemStatus}
            .context=${scenario.context}
            .contextOpen=${this.state === "context-breakdown"}
          ></workspace-status-bar>

          ${this.state === "diff"
            ? html`
              <div class="workspace-scrim">
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
              </div>
            `
            : nothing}
          ${this.state === "new-session"
            ? html`
              <div class="workspace-overlay" aria-label="New session overlay">
                <new-session .projects=${pinnedProjects}></new-session>
              </div>
            `
            : nothing}
          ${this.state === "projects"
            ? html`
              <div class="absolute left-2 top-32 z-20" aria-label="Project picker overlay">
                <project-picker .projects=${pinnedProjects}></project-picker>
              </div>
            `
            : nothing}
          ${this.state === "chat-search"
            ? html`
              <div class="workspace-overlay" aria-label="Chat search overlay">
                <chat-search
                  .chats=${scenario.searchChats}
                  .projects=${pinnedProjects}
                ></chat-search>
              </div>
            `
            : nothing}
        </workspace-layout>
      </div>
    `;
  }
}

customElements.define("agent-screen", AgentScreen);
