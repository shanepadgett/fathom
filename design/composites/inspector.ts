import type { InspectorData } from "../models.ts";

import { text } from "../primitives/content.ts";
import { iconButton } from "../primitives/controls.ts";
export const metricList = (metrics: [string, string][]) =>
  `<dl class="space-y-3">${metrics
    .map(
      ([label, value]) =>
        `<div class="flex justify-between gap-3"><dt>${text(label)}</dt><dd>${text(
          value,
        )}</dd></div>`,
    )
    .join("")}</dl>`;
export const inspectorSection = (title: string, content: string, first = false) =>
  `<section class="${
    first ? "" : "border-t border-line pt-4"
  }"><h3 class="mb-3 text-muted">${text(title)}</h3>${content}</section>`;
export const languageServerItem = (name: string) =>
  `<p class="flex justify-between gap-3">${text(
    name,
  )}<span class="text-success">Connected</span></p>`;
export const sessionInspector = (data: InspectorData) =>
  `<header class="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-4 font-medium"><span>Session</span>${iconButton(
    "x",
    "Close session panel",
  )}</header><div data-inspector-content class="min-h-0 flex-1 overflow-y-auto space-y-6 p-4 text-sm">${inspectorSection(
    "Usage",
    metricList(data.usage),
    true,
  )}${inspectorSection("Tokens", metricList(data.tokens))}${inspectorSection(
    "Language servers",
    `<div class="space-y-3">${data.servers
      .map(languageServerItem)
      .join("")}<p class="text-muted">0 errors · 1 warning</p></div>`,
  )}${inspectorSection(
    "Environment",
    `<p>${text(data.environment)}</p><p class="mt-2 text-muted">${text(
      data.environmentDetail,
    )}</p>`,
  )}</div>`;
