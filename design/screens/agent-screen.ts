import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";
import "../composites/chat-search.ts";
import "../composites/conversation-pane.ts";
import "../composites/diff-pane.ts";
import "../composites/project-picker.ts";
import "../composites/session-inspector.ts";
import "../composites/session-sidebar.ts";
import "../composites/workspace-header.ts";
import "../composites/workspace-status-bar.ts";
import { diffLines } from "../fixtures/diff.ts";
import { scenario } from "../fixtures/workspace-scenario.ts";
import "../layouts/workspace-body.ts";
import "../layouts/workspace-drawer.ts";
import "../layouts/workspace-layout.ts";
import "../layouts/workspace-overlay.ts";
import "../layouts/workspace-scrim.ts";
import "../layouts/workspace-shell.ts";
import "../layouts/workspace-sidebar.ts";

/** Static states of one screen, not routes or application state. */
export type AgentScreenState = "base" | "no-session" | "diff" | "projects" | "chat-search";

export class AgentScreen extends DesignElement {
  static override properties = { state: { type: String } };

  declare state: AgentScreenState;

  constructor() {
    super();
    this.state = "base";
  }

  override render() {
    return html`
      <workspace-shell>
        <workspace-layout>
          <workspace-header mode="agent"></workspace-header>

          <workspace-body>
            <workspace-sidebar placement="chats" role="complementary" aria-label="Project sessions">
              <session-sidebar
                .chats=${scenario.chats}
                .projects=${scenario.projects}
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

          <workspace-status-bar
            .status=${scenario.selectedChat.status ?? "Idle"}
            .changed=${scenario.changes.count}
            .context=${scenario.context}
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
          ${
            this.state === "projects"
              ? html`
                  <workspace-overlay aria-label="Project picker overlay">
                    <project-picker .projects=${scenario.projects}></project-picker>
                  </workspace-overlay>
                `
              : nothing
          }
          ${
            this.state === "chat-search"
              ? html`
                  <workspace-overlay aria-label="Chat search overlay">
                    <chat-search
                      .chats=${scenario.searchChats}
                      .projects=${scenario.projects}
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
