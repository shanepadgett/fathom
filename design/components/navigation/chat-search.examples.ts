import { html } from "lit";

import { scenario } from "../../fixtures/workspace-scenario.ts";
import "./chat-search.ts";

export const chatSearchExamples = [
  {
    name: "Chats",
    markup: html`
      <chat-search .chats=${scenario.searchChats} .projects=${scenario.projects}></chat-search>
    `,
  },
  {
    name: "Empty results",
    markup: html`<chat-search .chats=${[]} .projects=${scenario.projects}></chat-search>`,
  },
];
