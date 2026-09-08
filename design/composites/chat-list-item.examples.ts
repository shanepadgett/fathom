import { html } from "lit";

import { scenario } from "../fixtures/workspace-scenario.ts";
import "./chat-list-item.ts";
import "./chat-list.ts";

const longChat = {
  ...scenario.chats[0],
  title:
    "Investigate synchronization between multiple workspace windows after renaming a very long session title",
  branch: "feature/synchronize-session-titles-across-workspaces",
};

export const chatListItemExamples = [
  {
    name: "Long title",
    markup: html`
      <div class="w-sidebar bg-surface">
        <chat-list-item
          .chat=${longChat}
          .project=${scenario.projects[0]}
          .selected=${true}
        ></chat-list-item>
        <chat-list-item .chat=${longChat} .project=${scenario.projects[0]}></chat-list-item>
      </div>
    `,
  },
];
