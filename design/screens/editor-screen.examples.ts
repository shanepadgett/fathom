import type { DesignEntry } from "../site/design-entry.ts";

import { html } from "lit";

import "./editor-screen.ts";

// IDs are stable viewer links, including the older “no-session” URLs.
export const editorScreens: DesignEntry[] = [
  {
    id: "editor-focus",
    name: "Editor focus",
    description:
      "A source file is open in the editor, with its folder expanded and file selected in the explorer. The agent drawer is closed.",
    examples: [
      {
        name: "Editor workspace",
        markup: html`<editor-screen></editor-screen>`,
      },
    ],
  },
  {
    id: "editor-focus-changes",
    name: "Editor focus · Changes",
    description:
      "The editor sidebar shows changed files instead of the folder tree. The selected source file remains open in the editor.",
    examples: [
      {
        name: "Editor workspace",
        markup: html`<editor-screen state="changes"></editor-screen>`,
      },
    ],
  },
  {
    id: "editor-focus-drawer",
    name: "Editor focus · Agent open",
    description:
      "The agent conversation is open in a full-height drawer on the right. The editor and file explorer remain behind the dimmed overlay.",
    examples: [
      {
        name: "Editor workspace",
        markup: html`<editor-screen state="agent"></editor-screen>`,
      },
    ],
  },
];
