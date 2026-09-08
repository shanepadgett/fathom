import { html } from "lit";

import "./editor-screen.ts";

export const editorFocusExamples = [
  {
    name: "Editor workspace",
    markup: html`<editor-screen></editor-screen>`,
  },
];

export const editorDrawerExamples = [
  {
    name: "Editor workspace",
    markup: html`<editor-screen state="agent"></editor-screen>`,
  },
];

export const editorChangesExamples = [
  {
    name: "Editor workspace",
    markup: html`<editor-screen state="changes"></editor-screen>`,
  },
];
