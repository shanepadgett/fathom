import {
  compositeEntries,
  primitiveEntries,
} from "./composites/catalog.examples.ts";
import { buttonExamples } from "./components/button.examples.ts";
import {
  agentChatSearchExamples,
  agentDrawerExamples,
  agentFocusExamples,
  agentNoSessionExamples,
  agentProjectPickerExamples,
  editorChangesExamples,
  editorDrawerExamples,
  editorFocusExamples,
} from "./screens/workspace.ts";
import {
  accordionExamples,
  drawerExamples,
  modalExamples,
} from "./components/motion.examples.ts";

// Local, authored markup only. Never put external data into these templates.
export interface DesignEntry {
  id: string;
  name: string;
  description: string;
  category?: "Primitives" | "Composites" | "Behavior demos";
  examples: { name: string; markup: string }[];
}

export const components: DesignEntry[] = [
  ...primitiveEntries.map((entry) => ({
    ...entry,
    category: "Primitives" as const,
  })),
  ...compositeEntries.map((entry) => ({
    ...entry,
    category: "Composites" as const,
  })),
  {
    id: "modal",
    category: "Behavior demos",
    name: "Modal",
    description: "A focused dialog with a lightly darkened backdrop.",
    examples: modalExamples,
  },
  {
    id: "drawer",
    category: "Behavior demos",
    name: "Drawer",
    description: "A side panel for supporting content.",
    examples: drawerExamples,
  },
  {
    id: "accordion",
    category: "Behavior demos",
    name: "Accordion",
    description:
      "Expandable sections. Allow one or multiple sections to stay open.",
    examples: accordionExamples,
  },
  {
    id: "button",
    category: "Primitives",
    name: "Button",
    description: "Triggers an action.",
    examples: buttonExamples,
  },
];

export const screens: DesignEntry[] = [
  {
    id: "agent-focus",
    name: "Agent focus · Session open",
    description:
      "Static layout study. Conversation first; the diff overlay is shown on its own screen. Scroll horizontally on smaller windows.",
    examples: agentFocusExamples,
  },
  {
    id: "agent-focus-no-session",
    name: "Agent focus · Session closed",
    description:
      "Static layout study. Conversation expands into the space available with the Session panel closed.",
    examples: agentNoSessionExamples,
  },
  {
    id: "agent-focus-drawer",
    name: "Agent focus · Diff open",
    description:
      "Static layout study. The diff overlays the workspace; the stats rail stays underneath.",
    examples: agentDrawerExamples,
  },
  {
    id: "agent-focus-project-picker",
    name: "Agent focus · Project picker",
    description:
      "Static layout study. Project selection overlays only the workspace, with search first and compact keyboard hints.",
    examples: agentProjectPickerExamples,
  },
  {
    id: "agent-focus-chat-search",
    name: "Agent focus · Search chats",
    description:
      "Static layout study. Search existing chats across projects, with recent chats and keyboard hints.",
    examples: agentChatSearchExamples,
  },
  {
    id: "editor-focus",
    name: "Editor focus",
    description:
      "Static layout study. Files first; the agent overlay is shown on its own screen. Scroll horizontally on smaller windows.",
    examples: editorFocusExamples,
  },
  {
    id: "editor-focus-changes",
    name: "Editor focus · Changes",
    description:
      "Static layout study. Changed files use the same compact file rows as the explorer.",
    examples: editorChangesExamples,
  },
  {
    id: "editor-focus-drawer",
    name: "Editor focus · Agent open",
    description:
      "Static layout study. The agent drawer spans the full app height with its close control in the drawer title bar.",
    examples: editorDrawerExamples,
  },
];
