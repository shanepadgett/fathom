import type { DesignEntry } from "../site/design-entry.ts";

import { html } from "lit";

import "./chat-screen.ts";

// IDs are stable viewer links, including the older “no-session” URLs.
export const chatScreens: DesignEntry[] = [
  {
    id: "chat-focus",
    name: "Chat focus · Inspector open",
    description:
      "A web research conversation with chat history on the left and session usage and tokens on the right.",
    examples: [{
      name: "Chat workspace",
      markup: html`<chat-screen></chat-screen>`,
    }],
  },
  {
    id: "chat-focus-no-session",
    name: "Chat focus · Inspector closed",
    description:
      "The same web research conversation with the session inspector closed, giving the chat more space.",
    examples: [
      {
        name: "Chat workspace",
        markup: html`<chat-screen state="inspector-closed"></chat-screen>`,
      },
    ],
  },
];
