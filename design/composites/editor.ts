import { changeStatus, text } from "../primitives/content.ts";
import { iconButton } from "../primitives/controls.ts";
import type { CodeLine, FileNode } from "../models.ts";
export const editorTab = (file: FileNode, selected: boolean) =>
  `<div class="flex items-center gap-3 border-r border-line px-4 ${
    selected ? "border-t-2 border-t-action bg-canvas" : "text-muted"
  }"><button type="button" aria-pressed="${selected}" class="truncate">${
    text(file.name)
  }</button>${changeStatus(file.status)}${
    iconButton("x", `Close ${file.name}`)
  }</div>`;
export const editorTabs = (files: FileNode[], selected: string) =>
  `<div class="flex h-9 shrink-0 overflow-hidden border-b border-line bg-surface text-sm" role="group" aria-label="Open files">${
    files.map((file) => editorTab(file, file.id === selected)).join("")
  }</div>`;
export const breadcrumbs = (path: string[]) =>
  `<p data-component="breadcrumbs" class="flex h-9 shrink-0 items-center gap-1 overflow-hidden border-b border-line px-4 text-sm text-muted">${
    path.map((part, index) =>
      `${
        index ? '<span aria-hidden="true">/</span>' : ""
      }<span class="truncate ${index === path.length - 1 ? "text-ink" : ""}">${
        text(part)
      }</span>`
    ).join("")
  }</p>`;
/** Line markup is exclusively trusted authored syntax, never external text. */
export const codePreview = (lines: CodeLine[]) =>
  `<div class="flex min-h-0 flex-1 overflow-auto py-4"><pre class="select-none border-r border-line px-4 text-right font-mono text-sm leading-relaxed text-muted" aria-hidden="true">${
    lines.map((_, index) => index + 1).join("\n")
  }</pre><pre class="px-6 font-mono text-sm leading-relaxed" aria-label="Sample TypeScript code">${
    lines.map((line) =>
      `<span class="block ${line.added ? "bg-success/10" : ""}">${
        line.markup || " "
      }</span>`
    ).join("")
  }</pre></div>`;
export const editorStatusBar = () =>
  `<div class="flex justify-between gap-3 border-t border-line px-4 py-2 text-xs text-muted"><span>Problems <span class="ml-3 text-warning">1 warning</span></span><span>Ln 18, Col 3 · UTF-8 · TypeScript</span></div>`;
export const editorPane = (
  files: FileNode[],
  selected: string,
  path: string[],
  lines: CodeLine[],
) =>
  `<section data-component="editor-pane" class="flex min-w-0 flex-1 flex-col" aria-label="Code editor">${
    editorTabs(files, selected)
  }${breadcrumbs(path)}${codePreview(lines)}${editorStatusBar()}</section>`;
