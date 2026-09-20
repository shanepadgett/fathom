import type { Chat, Project } from "../models/session.ts";

export const projects: Project[] = [
  { id: "fathom", name: "Fathom", path: "~/dev/open-source/fathom" },
  { id: "design", name: "Design reference", path: "~/dev/design-reference" },
];

export const chats: Chat[] = [
  {
    id: "rename",
    title: "Keep session titles in sync",
    projectId: "fathom",
    branch: "main",
    time: "Now",
    status: "Reviewing changes",
    activity: "running",
  },
  {
    id: "trust",
    title: "Add workspace trust prompt",
    projectId: "fathom",
    branch: "workspace-trust",
    activity: "attention",
    unread: true,
    time: "2h",
  },
  {
    id: "reconnect",
    activity: "completed",
    unread: true,
    title: "Trace reconnect behavior",
    projectId: "fathom",
    branch: "main",
    time: "1d",
  },
  {
    id: "context",
    title: "Review context accounting",
    projectId: "fathom",
    branch: "main",
    time: "1d",
  },
  {
    id: "layouts",
    activity: "completed",
    unread: false,
    title: "Refine workspace layouts",
    projectId: "design",
    branch: "main",
    time: "2d",
  },
];
