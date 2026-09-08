import type { FileNode } from "../models.ts";
import type { Changes } from "../models.ts";

import { changeStatus, diffStat, emptyState, icon, text } from "../primitives/content.ts";
import { tabStrip } from "../primitives/controls.ts";
export const fileItem = (file: FileNode, selected = false, tree = false) =>
  `<div data-file-row class="flex h-6 min-w-0 items-center gap-1.5 rounded-sm pr-2 ${
    tree ? "pl-5" : "pl-2"
  } ${selected ? "bg-action/10 text-action" : "text-ink hover:bg-canvas"}" ${
    selected ? 'aria-current="true"' : ""
  } title="${text(file.name)}"><span class="flex shrink-0 ${
    selected ? "text-action" : "text-muted"
  }">${icon(
    file.icon ?? "file-text",
  )}</span><span class="min-w-0 flex-1 truncate">${text(file.name)}</span>${changeStatus(
    file.status,
  )}</div>`;
export const folderItem = (name: string, expanded: boolean) =>
  `<button type="button" class="flex h-6 w-full min-w-0 items-center gap-1.5 rounded-sm px-1 text-left hover:bg-canvas" aria-expanded="${expanded}"><span class="flex items-center gap-1.5 text-muted">${icon(
    expanded ? "caret-down" : "caret-right",
    "small",
  )}${icon(expanded ? "folder-open" : "folder")}</span><span class="truncate">${text(
    name,
  )}</span></button>`;
const treeNode = (node: FileNode, selected: string, expanded: string[]): string =>
  node.children
    ? `<div>${folderItem(node.name, expanded.includes(node.id))}${
        expanded.includes(node.id)
          ? `<div class="ml-2.5 border-l border-line pl-1.5">${node.children
              .map((child) => treeNode(child, selected, expanded))
              .join("")}</div>`
          : ""
      }</div>`
    : fileItem(node, node.id === selected, true);
export const fileTree = (nodes: FileNode[], selected: string, expanded: string[]) =>
  `<div data-component="file-tree" class="p-2 text-dense leading-none" aria-label="File explorer">${nodes
    .map((node) => treeNode(node, selected, expanded))
    .join("")}</div>`;
export const changedFilesList = (files: FileNode[], selected: string, changes: Changes) =>
  `<div data-component="changed-files" class="p-2 text-dense" aria-label="Changed files"><p class="flex flex-wrap items-center gap-2 px-2 pb-2 text-muted">${files.length} files changed ${diffStat(
    changes.added,
    changes.removed,
  )}</p>${
    files.length
      ? files.map((file) => fileItem(file, file.id === selected)).join("")
      : emptyState("No changed files")
  }</div>`;
export const filesSidebar = (
  nodes: FileNode[],
  changed: FileNode[],
  selected: string,
  expanded: string[],
  changes: Changes,
  view: "files" | "changes" = "files",
) =>
  `${tabStrip(
    [
      { id: "files", label: "Files" },
      { id: "changes", label: "Changes" },
    ],
    view,
    "Files and changes",
  )}${
    view === "files"
      ? fileTree(nodes, selected, expanded)
      : changedFilesList(changed, selected, changes)
  }`;
