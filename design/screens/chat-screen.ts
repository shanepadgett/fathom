import { html, nothing } from "lit";

import { DesignElement } from "../components/design-element.ts";
import { chatScenario as scenario } from "../fixtures/chat-scenario.ts";
import "../composites/conversation-pane.ts";
import "../composites/session-inspector.ts";
import "../composites/session-sidebar.ts";
import "../composites/workspace-header.ts";
import "../composites/workspace-status-bar.ts";
import { systemStatus } from "../fixtures/system-status.ts";
import "../layouts/workspace-layout.ts";
import "../layouts/workspace-sidebar.ts";

/** Static states of one screen, not routes or application state. */
export type ChatScreenState = "base" | "inspector-closed";

export class ChatScreen extends DesignElement {
  static override properties = { state: { type: String } };

  declare state: ChatScreenState;

  constructor() {
    super();
    this.state = "base";
  }

  override render() {
    return html`
      <div class="workspace-shell">
        <workspace-layout>
          <workspace-header mode="chat"></workspace-header>

          <div class="workspace-body">
            <workspace-sidebar placement="chats" role="complementary" aria-label="Chats">
              <session-sidebar
                mode="chat"
                .pinned=${scenario.chats.slice(0, 2).map((chat) => chat.id)}
                .chats=${scenario.chats}
                .selected=${scenario.selectedChat.id}
              ></session-sidebar>
            </workspace-sidebar>

            <conversation-pane
              mode="chat"
              .title=${scenario.selectedChat.title}
              .messages=${scenario.messages}
              .changes=${scenario.changes}
              .model=${scenario.model}
              .reasoning=${scenario.reasoning}
            ></conversation-pane>

            ${
              this.state === "inspector-closed"
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
          </div>

          <workspace-status-bar
            .system=${systemStatus}
            .context=${scenario.context}
          ></workspace-status-bar>
        </workspace-layout>
      </div>
    `;
  }
}

customElements.define("chat-screen", ChatScreen);
