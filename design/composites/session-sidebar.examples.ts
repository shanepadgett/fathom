import { html } from "lit";

import { scenario } from "../fixtures/workspace-scenario.ts";
import "./session-sidebar.ts";

export const sessionSidebarExamples = [
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
