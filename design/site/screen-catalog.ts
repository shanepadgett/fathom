import type { DesignEntry } from "./design-entry.ts";

import {
  agentChatSearchExamples,
  agentContextMenuExamples,
  agentContextBreakdownExamples,
  agentDrawerExamples,
  agentFocusExamples,
  agentNoSessionExamples,
  agentNewSessionExamples,
  agentProjectPickerExamples,
} from "../screens/agent-screen.examples.ts";
import {
  editorChangesExamples,
  editorDrawerExamples,
  editorFocusExamples,
} from "../screens/editor-screen.examples.ts";

import { chatFocusExamples, chatNoSessionExamples } from "../screens/chat-screen.examples.ts";

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
    id: "agent-focus-new-session",
    name: "Agent focus · New session",
    description: "The new-session modal is open, ready to choose a project before starting a session.",
    examples: agentNewSessionExamples,
  },
  {
    id: "agent-focus-project-picker",
    name: "Agent focus · Project picker",
    description:
      "The project dropdown is open beneath All projects, showing the current selection and project names with workspace paths.",
    examples: agentProjectPickerExamples,
  },
  {
    id: "agent-focus-chat-search",
    name: "Agent focus · Search sessions",
    description:
      "Session search is open across all projects with an empty query. Recent sessions are shown, with the first chat selected and ready to open.",
    examples: agentChatSearchExamples,
  },
  {
    id: "agent-focus-drawer",
    name: "Agent focus · Diff open",
    description:
      "A file diff is open in a right-side drawer for reviewing additions and deletions. The conversation and session inspector remain behind the dimmed overlay.",
    examples: agentDrawerExamples,
  },
  {
    id: "agent-focus-context-menus",
    name: "Agent focus · Context menus",
    description: "Thread and conversation menus shown together for comparison. Segments group navigation, thread actions, and archive; Rename includes an independent agent action. Actions are simulated.",
    examples: agentContextMenuExamples,
  },
  {
    id: "agent-focus-context-breakdown",
    name: "Agent focus · Context breakdown",
    description: "Context usage with its breakdown open and a compaction marker at 80% capacity.",
    examples: agentContextBreakdownExamples,
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
  {
    id: "chat-focus",
    name: "Chat focus · Session open",
    description: "A web research conversation with chat history on the left and session usage and tokens on the right.",
    examples: chatFocusExamples,
  },
  {
    id: "chat-focus-no-session",
    name: "Chat focus · Session closed",
    description: "The same web research conversation with the session inspector closed, giving the chat more space.",
    examples: chatNoSessionExamples,
  },
];
