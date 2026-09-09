import { html } from "lit";

import "./chat-screen.ts";

export const chatFocusExamples = [
  { name: "Chat workspace", markup: html`<chat-screen></chat-screen>` },
];

export const chatNoSessionExamples = [
  { name: "Chat workspace", markup: html`<chat-screen state="no-session"></chat-screen>` },
];
