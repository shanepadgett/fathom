import type { Chat, Project } from "../models.ts";
import { emptyState, icon, shortcutHint, text } from "../primitives/content.ts";
import { searchFieldPreview } from "../primitives/controls.ts";
import { chatMetadata } from "./identities.ts";
export const keyboardHintBar = (action: string) =>
  `<footer class="flex h-9 items-center gap-4 border-t border-line bg-surface px-4 text-micro text-muted">${
    shortcutHint(["↑", "↓"], "Navigate")
  }${shortcutHint(["Enter"], action)}${
    shortcutHint(["Esc"], "Close")
  }</footer>`;
export const searchSurface = (
  label: string,
  heading: string,
  field: string,
  results: string,
  action: string,
) =>
  `<section data-component="search-surface" class="w-search-panel overflow-hidden rounded-lg border border-line bg-canvas shadow-md" aria-label="${
    text(label)
  }">${field}<div class="px-2 pb-2"><h3 class="px-3 py-2 text-xs text-muted">${
    text(heading)
  }</h3>${results}</div>${keyboardHintBar(action)}</section>`;
const resultFrame = (
  leading: string,
  body: string,
  trailing: string,
  selected: boolean,
) =>
  `<div class="flex items-center gap-3 rounded-control px-3 py-2.5 ${
    selected ? "bg-surface" : ""
  }">${leading}<div class="min-w-0 flex-1">${body}</div><span class="shrink-0 text-xs text-muted">${trailing}</span></div>`;
export const projectSearchResult = (
  project: Project,
  shortcut: string,
  selected = false,
) =>
  resultFrame(
    `<span class="text-muted">${icon("folder", "large")}</span>`,
    `<p class="truncate text-sm">${
      text(project.name)
    }</p><p class="mt-0.5 truncate text-xs text-muted">Local · ${
      text(project.path)
    }</p>`,
    text(shortcut),
    selected,
  );
export const chatSearchResult = (
  chat: Chat,
  project: Project,
  selected = false,
) =>
  resultFrame(
    `<span class="text-muted">${icon("chat-circle-text", "large")}</span>`,
    `<p class="truncate text-sm" title="${text(chat.title)}">${
      text(chat.title)
    }</p><div class="mt-1 text-xs text-muted">${
      chatMetadata(project.name, chat.branch)
    }</div>`,
    text(chat.time),
    selected,
  );
export const projectPicker = (projects: Project[]) =>
  searchSurface(
    "Choose a project",
    "Projects",
    searchFieldPreview("Search projects…"),
    projects.length
      ? projects.map((project, index) =>
        projectSearchResult(project, `⌘${index + 1}`, index === 0)
      ).join("")
      : emptyState("No projects found"),
    "Select",
  );
export const chatSearch = (chats: Chat[], projects: Project[]) =>
  searchSurface(
    "Search chats",
    "Recent chats",
    searchFieldPreview("Search chats…", true, "All projects"),
    chats.length
      ? chats.map((chat, index) =>
        chatSearchResult(
          chat,
          projects.find((project) => project.id === chat.projectId)!,
          index === 0,
        )
      ).join("")
      : emptyState("No chats found"),
    "Open chat",
  );
