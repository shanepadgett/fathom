import { html } from "lit";

import { messageStructure } from "../../fixtures/message-structure.ts";
import "./message-header.ts";

export const messageHeaderExamples = [
  ...[
    ["10. Flip book · selected", "pages"],
    ["12. Ripple", "ripple"],
    ["13. Sonar sweep", "sonar"],
    ["14. Sounding line", "sounding"],
    ["17. Rising bubbles", "bubbles"],
  ].map(([name, animation]) => ({
    name,
    markup: html`<message-header .message=${{ ...messageStructure.update, working: true }} .animation=${animation}></message-header>`,
  })),
  { name: "Response finished", markup: html`<message-header .message=${{ ...messageStructure.update, working: false }}></message-header>` },
  { name: "User", markup: html`<message-header .message=${messageStructure.user}></message-header>` },
  { name: "Edited prompt", markup: html`<message-header .message=${{ ...messageStructure.user, edited: true }}></message-header>` },
];
