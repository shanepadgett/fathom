import type { DesignEntry } from "../site/design-entry.ts";

import { html } from "lit";

import "./agent-screen.ts";

// IDs are stable viewer links, including the older “no-session” URLs.
export const agentScreens: DesignEntry[] = [
  {
    id: "agent-focus",
    name: "Agent focus · Inspector open",
    description:
      "An agent conversation is open, with project sessions on the left and the session inspector on the right. No overlay is open.",
    examples: [
      {
        name: "Agent workspace",
        markup: html`<agent-screen></agent-screen>`,
      },
    ],
  },
  {
    id: "agent-focus-no-session",
    name: "Agent focus · Inspector closed",
    description:
      "The session inspector is closed, giving the agent conversation more space. Project sessions remain visible on the left.",
    examples: [
      {
        name: "Agent workspace",
        markup: html`<agent-screen state="inspector-closed"></agent-screen>`,
      },
    ],
  },
  {
    id: "agent-focus-new-session",
    name: "Agent focus · New session",
    description:
      "The new-session modal is open, ready to choose a project before starting a session.",
    examples: [
      { name: "New session", markup: html`<agent-screen state="new-session"></agent-screen>` },
    ],
  },
  {
    id: "agent-focus-project-picker",
    name: "Agent focus · Project picker",
    description:
      "The project dropdown is open beneath All projects, showing the current selection and project names with workspace paths.",
    examples: [
      {
        name: "Agent workspace",
        markup: html`<agent-screen state="projects"></agent-screen>`,
      },
    ],
  },
  {
    id: "agent-focus-chat-search",
    name: "Agent focus · Search sessions",
    description:
      "Session search is open across all projects with an empty query. Recent sessions are shown, with the first chat selected and ready to open.",
    examples: [
      {
        name: "Agent workspace",
        markup: html`<agent-screen state="chat-search"></agent-screen>`,
      },
    ],
  },
  {
    id: "agent-focus-drawer",
    name: "Agent focus · Diff open",
    description:
      "A file diff is open in a right-side drawer for reviewing additions and deletions. The conversation and session inspector remain behind the dimmed overlay.",
    examples: [
      {
        name: "Agent workspace",
        markup: html`<agent-screen state="diff"></agent-screen>`,
      },
    ],
  },
  {
    id: "agent-focus-context-menus",
    name: "Agent focus · Context menus",
    description:
      "Thread and conversation menus shown together for comparison. Segments group navigation, thread actions, and archive; Rename includes an independent agent action. Actions are simulated.",
    examples: [
      {
        name: "Thread and conversation menus",
        markup: html`<agent-screen state="context-menus"></agent-screen>`,
      },
    ],
  },
  {
    id: "agent-focus-context-breakdown",
    name: "Agent focus · Context breakdown",
    description: "Context usage with its breakdown open and a compaction marker at 80% capacity.",
    examples: [
      {
        name: "Context breakdown open",
        markup: html`<agent-screen state="context-breakdown"></agent-screen>`,
      },
    ],
  },
];
