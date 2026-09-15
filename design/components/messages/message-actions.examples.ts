import { html } from "lit";

import { messageStructure } from "../../fixtures/message-structure.ts";
import { messageActions } from "./message-actions.ts";
import "./chat-message.ts";

export const messageActionsExamples = [
  { name: "User actions", markup: html`<div><chat-message .item=${messageStructure.user} .changes=${{ count: 0, added: 0, removed: 0 }}></chat-message>${messageActions("user")}</div>` },
  { name: "Agent actions", markup: html`<div><chat-message .item=${messageStructure.answer} .changes=${{ count: 0, added: 0, removed: 0 }}></chat-message>${messageActions("agent")}</div>` },
  { name: "While responding", markup: html`<div><chat-message .item=${messageStructure.update} .changes=${{ count: 0, added: 0, removed: 0 }}></chat-message>${messageActions("agent", true)}</div>` },
];
