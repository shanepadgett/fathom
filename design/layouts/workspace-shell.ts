import { text } from "../primitives/content.ts";
/** Slots accept trusted, locally rendered component markup. */
export interface WorkspaceSlots {
  header: string;
  leading: string;
  primary: string;
  trailing?: string;
  footer: string;
  drawer?: string;
  overlay?: string;
}
export const workspaceShell = (slots: WorkspaceSlots) =>
  `<div class="overflow-x-auto rounded-lg border border-line" data-workspace-frame><div data-workspace class="relative flex h-workspace-preview min-w-workspace-minimum flex-col bg-canvas">${slots.header}<div data-workspace-body class="relative flex min-h-0 flex-1">${slots.leading}${slots.primary}${
    slots.trailing ?? ""
  }</div>${slots.footer}${slots.drawer ?? ""}${
    slots.overlay ?? ""
  }</div></div>`;
export const sidebarPane = (
  content: string,
  label: string,
  placement: "chats" | "files" | "inspector",
) =>
  `<aside class="relative shrink-0 bg-surface flex min-h-0 flex-col ${
    placement === "files" ? "w-files-sidebar" : "w-sidebar"
  } ${
    placement === "inspector" ? "border-l" : "border-r"
  } border-line" aria-label="${text(label)}">${
    placement === "inspector"
      ? content
      : `<div class="min-h-0 flex-1 overflow-y-auto">${content}</div>`
  }<edge-resizer edge="${
    placement === "inspector" ? "left" : "right"
  }"></edge-resizer></aside>`;
export const workspaceDrawer = (
  content: string,
  kind: "diff" | "conversation",
) =>
  `<div class="absolute inset-0 z-20 overlay-glass" data-drawer-overlay><section class="pointer-events-auto absolute inset-y-0 right-0 z-10 flex flex-col border-l border-line bg-canvas shadow-md ${
    kind === "diff" ? "w-diff-drawer" : "w-conversation-drawer"
  }" aria-label="${
    kind === "diff" ? "File diff overlay" : "Agent overlay"
  }">${content}<edge-resizer edge="left"></edge-resizer></section></div>`;
export const workspaceOverlay = (content: string, label: string) =>
  `<div data-workspace-overlay class="absolute inset-0 z-30 flex items-start justify-center overflow-hidden pt-24 overlay-glass" aria-label="${
    text(label)
  }">${content}</div>`;
