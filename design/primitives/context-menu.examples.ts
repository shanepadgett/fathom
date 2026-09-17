import { html } from "lit";

import { conversationMenu, threadMenu } from "../fixtures/context-menus.ts";
import "./context-menu.ts";

export const contextMenuExamples = [
  {
    name: "Thread options",
    markup: html`
      <ds-context-menu preview label="Thread options" .sections=${threadMenu}></ds-context-menu>
    `,
  },
  {
    name: "Conversation options",
    markup: html`
      <ds-context-menu
        preview
        label="Conversation options"
        .sections=${conversationMenu}
      ></ds-context-menu>
    `,
  },
];
