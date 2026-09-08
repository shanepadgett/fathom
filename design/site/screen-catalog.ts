import type { DesignEntry } from "./design-entry.ts";

import {
  agentChatSearchExamples,
  agentDrawerExamples,
  agentFocusExamples,
  agentNoSessionExamples,
  agentProjectPickerExamples,
} from "../screens/agent-screen.examples.ts";
import {
  editorChangesExamples,
  editorDrawerExamples,
  editorFocusExamples,
} from "../screens/editor-screen.examples.ts";

export const screens: DesignEntry[] = [
  {
    id: "agent-focus",
    name: "Agent focus · Session open",
    description:
      "An agent conversation is open, with project sessions on the left and the session inspector on the right. No overlay is open.",
    examples: agentFocusExamples,
  },
  {
    id: "agent-focus-no-session",
    name: "Agent focus · Session closed",
    description:
      "The session inspector is closed, giving the agent conversation more space. Project sessions remain visible on the left.",
    examples: agentNoSessionExamples,
  },
  {
    id: "agent-focus-drawer",
    name: "Agent focus · Diff open",
    description:
      "A file diff is open in a right-side drawer for reviewing additions and deletions. The conversation and session inspector remain behind the dimmed overlay.",
    examples: agentDrawerExamples,
  },
  {
    id: "agent-focus-project-picker",
    name: "Agent focus · Project picker",
    description:
      "The project picker is open over the agent workspace, ready to search for and switch projects. The current conversation remains behind the overlay.",
    examples: agentProjectPickerExamples,
  },
  {
    id: "agent-focus-chat-search",
    name: "Agent focus · Search chats",
    description:
      "Chat search is open across all projects with an empty query. Recent chats are shown, with the first chat selected and ready to open.",
    examples: agentChatSearchExamples,
  },
  {
    id: "editor-focus",
    name: "Editor focus",
    description:
      "A source file is open in the editor, with its folder expanded and file selected in the explorer. The agent drawer is closed.",
    examples: editorFocusExamples,
  },
  {
    id: "editor-focus-changes",
    name: "Editor focus · Changes",
    description:
      "The editor sidebar shows changed files instead of the folder tree. The selected source file remains open in the editor.",
    examples: editorChangesExamples,
  },
  {
    id: "editor-focus-drawer",
    name: "Editor focus · Agent open",
    description:
      "The agent conversation is open in a full-height drawer on the right. The editor and file explorer remain behind the dimmed overlay.",
    examples: editorDrawerExamples,
  },
];
