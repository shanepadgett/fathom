import { icon, meter } from "../primitives/content.ts";
import { drawerControl, iconButton } from "../primitives/controls.ts";
import { runStatus } from "./conversation.ts";
export type Focus = "agent" | "editor";
export const focusSwitch = (mode: Focus) =>
  `<div role="group" aria-label="Workspace focus" class="flex overflow-hidden rounded-control border border-line">${(
    ["agent", "editor"] as const
  )
    .map(
      (focus) =>
        `<button type="button" aria-label="${
          focus === "agent" ? "Agent" : "Editor"
        } focus" aria-pressed="${
          mode === focus
        }" class="flex h-8 w-10 items-center justify-center first:border-r first:border-line ${
          mode === focus ? "bg-canvas text-action" : "text-muted hover:text-ink"
        }">${icon(focus === "agent" ? "chat-circle-text" : "code", "toolbar")}</button>`,
    )
    .join("")}</div>`;
export const workspaceHeader = (mode: Focus) =>
  `<header class="flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface pl-4"><div class="flex min-w-0 items-center gap-6"><strong class="font-medium tracking-tight">Fathom</strong>${iconButton(
    "sidebar-simple",
    "Close sidebar",
    {
      sidebarToggle: true,
      toolbar: true,
    },
  )}</div>${`<div class="flex h-full items-center gap-3">${focusSwitch(mode)}${drawerControl(
    mode === "editor" ? "agent" : "diff",
  )}</div>`}</header>`;
export const workspaceStatusBar = (
  status: string,
  changed: number,
  context: { value: number; maximum: number },
) =>
  `<footer data-component="workspace-status" class="flex min-h-12 shrink-0 items-center justify-between gap-6 border-t border-line bg-surface px-4 text-sm"><div class="flex items-center gap-4">${runStatus(
    `Agent · ${status}`,
    "success",
  )}<span class="text-muted">${changed} files changed</span></div><div class="flex items-center gap-4">${meter(
    context.value,
    context.maximum,
    "Context usage",
  )}<span>${context.value}k / ${context.maximum}k</span></div></footer>`;
