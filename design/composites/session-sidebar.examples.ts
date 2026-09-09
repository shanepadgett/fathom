import { html } from "lit";

import { chatScenario } from "../fixtures/chat-scenario.ts";
import { pinnedProjects, pinnedSessions, pinnedSessionIds } from "../fixtures/pinned-sessions.ts";
import { scenario } from "../fixtures/workspace-scenario.ts";
import "./session-sidebar.ts";

export const sessionSidebarExamples = [
  {
    name: "Pinned sessions",
    markup: html`<div class="w-sidebar bg-surface">
      <session-sidebar
        .chats=${pinnedSessions}
        .projects=${pinnedProjects}
        .selected=${scenario.selectedChat.id}
        .pinned=${pinnedSessionIds}
      ></session-sidebar>
    </div>`,
  },
  {
    name: "Pinned chats",
    markup: html`<div class="w-sidebar bg-surface">
      <session-sidebar
        mode="chat"
        .chats=${chatScenario.chats}
        .selected=${chatScenario.selectedChat.id}
        .pinned=${chatScenario.chats.slice(0, 2).map((chat) => chat.id)}
      ></session-sidebar>
    </div>`,
  },
  {
    name: "Chats",
    markup: html`<div class="w-sidebar bg-surface">
      <session-sidebar
        mode="chat"
        .chats=${chatScenario.chats}
        .selected=${chatScenario.selectedChat.id}
      ></session-sidebar>
    </div>`,
  },
  {
    name: "Sidebar",
    markup: html`
      <div class="w-sidebar bg-surface">
        <session-sidebar
          .chats=${scenario.chats}
          .projects=${scenario.projects}
          .selected=${scenario.selectedChat.id}
        ></session-sidebar>
      </div>
    `,
  },
];
