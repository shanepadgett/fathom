import type { Chat, Project } from "../models.ts";
import { emptyState, icon, statusDot, text } from "../primitives/content.ts";
import { button, iconButton, projectSelector } from "../primitives/controls.ts";
import { branchIdentity, projectIdentity } from "./identities.ts";
export const chatListItem = (chat: Chat, project: Project, selected = false) =>
  `<div data-chat-item class="min-w-0 rounded-control px-2 py-2 ${
    selected ? "bg-action/10" : "hover:bg-canvas"
  }" ${selected ? 'aria-current="true"' : ""}>
  <div class="flex items-center justify-between gap-1.5 text-micro text-muted">${
    projectIdentity(project.name)
  }<span class="shrink-0">${text(chat.time)}</span></div>
  <p class="mt-1 truncate text-dense ${
    selected ? "text-action" : "text-ink"
  }" title="${text(chat.title)}">${text(chat.title)}</p>
  <div class="mt-1 flex min-w-0 items-center justify-between gap-1.5 text-micro text-muted">${
    branchIdentity(chat.branch)
  }${chat.status ? statusDot("action", chat.status, true) : ""}</div>
</div>`;
export const chatList = (
  chats: Chat[],
  projects: Project[],
  selected: string,
) =>
  `<div class="space-y-1 px-2">${
    chats.length
      ? chats.map((chat) =>
        chatListItem(
          chat,
          projects.find((project) => project.id === chat.projectId)!,
          chat.id === selected,
        )
      ).join("")
      : emptyState("No chats yet")
  }</div>`;
export const sessionSidebar = (
  chats: Chat[],
  projects: Project[],
  selected: string,
) =>
  `<div data-component="session-sidebar">
  <div class="flex h-10 items-center gap-2 px-3"><div class="min-w-0 flex-1">${
    button({
      label: "Search chats",
      content: `${icon("magnifying-glass")}Search chats`,
      variant: "quiet",
      size: "small",
    })
  }</div>${iconButton("note-pencil", "New chat")}</div>
  <div class="mx-2 mb-2">${projectSelector("All projects")}</div>
  ${chatList(chats, projects, selected)}
</div>`;
