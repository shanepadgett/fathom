import type { ContextMenuSection } from "../models/context-menu.ts";

export const threadMenu: ContextMenuSection[] = [
  [{ id: "pin", label: "Pin thread", icon: "push-pin" }],
  [
    { id: "fork", label: "Fork thread", icon: "git-branch" },
    { id: "rename", label: "Rename", icon: "note-pencil", agentAction: true },
  ],
  [{ id: "archive", label: "Archive thread", icon: "archive" }],
];

export const conversationMenu: ContextMenuSection[] = [
  [{ id: "pin", label: "Pin thread", icon: "push-pin" }],
  [
    { id: "session", label: "Toggle session info", icon: "sidebar-simple" },
    { id: "tree", label: "View thread tree", icon: "tree-structure" },
    { id: "quick-chat", label: "Quick chat (aside)", icon: "chat-circle-text" },
  ],
  [
    { id: "fork", label: "Fork conversation", icon: "git-branch" },
    { id: "rename", label: "Rename", icon: "note-pencil", agentAction: true },
  ],
  [{ id: "archive", label: "Archive conversation", icon: "archive" }],
];
