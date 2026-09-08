import { drawerControl } from "../primitives/controls.ts";
import { diffStat, text } from "../primitives/content.ts";
import { breadcrumbs } from "./editor.ts";
import type { DiffLine } from "../models.ts";
const lineColors = {
  context: "text-muted",
  added: "bg-success/10 text-success",
  removed: "bg-danger/10 text-danger",
};
export const diffPreview = (lines: DiffLine[]) =>
  `<div class="overflow-auto py-6 font-mono text-sm leading-relaxed">${
    lines.map((line) =>
      `<pre class="px-6 ${lineColors[line.kind]}">${text(line.text)}</pre>`
    ).join("")
  }</div>`;
export const diffPane = (
  path: string[],
  lines: DiffLine[],
  count: number,
  added: number,
  removed: number,
  drawer = false,
) =>
  `<section aria-label="File diff" class="min-h-0 flex-1 overflow-y-auto"><header class="flex ${
    drawer ? "h-12 pl-6" : "h-16 px-6"
  } items-center justify-between border-b border-line font-medium"><span>Changed files <span class="ml-3 text-sm text-muted">${count}</span></span>${
    drawer ? drawerControl("diff", true) : ""
  }</header>${breadcrumbs(path)}<div class="border-b border-line px-6 py-2">${
    diffStat(added, removed)
  }</div>${
    diffPreview(lines)
  }<p class="px-6 text-sm text-muted">Showing 1 of ${count} changed files</p></section>`;
