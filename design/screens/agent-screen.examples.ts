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

export const agentContextMenuExamples = [
  {
    name: "Thread and conversation menus",
    markup: html`<agent-screen state="context-menus"></agent-screen>`,
  },
];

export const agentContextBreakdownExamples = [
  {
    name: "Context breakdown open",
    markup: html`<agent-screen state="context-breakdown"></agent-screen>`,
  },
];

export const agentNewSessionExamples = [
  { name: "New session", markup: html`<agent-screen state="new-session"></agent-screen>` },
];
