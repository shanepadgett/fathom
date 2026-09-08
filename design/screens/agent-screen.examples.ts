import { html } from "lit";

import "./agent-screen.ts";

export const agentFocusExamples = [
  {
    name: "Agent workspace",
    markup: html`<agent-screen></agent-screen>`,
  },
];

export const agentNoSessionExamples = [
  {
    name: "Agent workspace",
    markup: html`<agent-screen state="no-session"></agent-screen>`,
  },
];

export const agentDrawerExamples = [
  {
    name: "Agent workspace",
    markup: html`<agent-screen state="diff"></agent-screen>`,
  },
];

export const agentProjectPickerExamples = [
  {
    name: "Agent workspace",
    markup: html`<agent-screen state="projects"></agent-screen>`,
  },
];

export const agentChatSearchExamples = [
  {
    name: "Agent workspace",
    markup: html`<agent-screen state="chat-search"></agent-screen>`,
  },
];
