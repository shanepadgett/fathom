import { html } from "lit";

import { scenario } from "../fixtures/workspace-scenario.ts";
import "./chat-message.ts";

export const chatMessageExamples = [
  {
    name: "Message",
    markup: html`
      <chat-message .item=${scenario.messages[1]} .changes=${scenario.changes}></chat-message>
    `,
  },
];
