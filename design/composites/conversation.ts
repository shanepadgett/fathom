import { drawerControl } from "../primitives/controls.ts";
import type { Message, MessageBlock } from "../models.ts";
import {
  diffStat,
  icon,
  statusDot,
  text,
  type Tone,
} from "../primitives/content.ts";
import { button, iconButton, selectorButton } from "../primitives/controls.ts";
import type { Changes } from "../models.ts";
export const changeSummary = (changes: Changes, description = "") =>
  `<div class="mt-4 border-l-2 border-action pl-4"><p class="flex items-center gap-3 font-medium">${changes.count} files changed ${
    diffStat(changes.added, changes.removed)
  }</p>${
    description
      ? `<p class="mt-2 text-sm text-muted">${text(description)}</p>`
      : ""
  }</div>`;
export const runStatus = (label: string, tone: Tone = "action") =>
  `<span class="flex items-center gap-2">${statusDot(tone)}${
    text(label)
  }</span>`;
export const messageHeader = (message: Message) =>
  `<header class="mb-3 flex items-center gap-3"><h3 class="font-semibold ${
    message.agent ? "text-action" : ""
  }">${text(message.author)}</h3><span class="text-sm text-muted">${
    text(message.time)
  }</span></header>`;
export const toolActivity = (
  label: string,
  duration: string,
  files: string[],
) =>
  `<div class="my-6 border-y border-line py-3 text-sm"><p class="flex justify-between gap-4"><span class="flex items-center gap-1">${
    icon("check")
  }${text(label)}</span><span class="text-muted">${
    text(duration)
  }</span></p><p class="mt-2 break-words font-mono text-muted">${
    files.map(text).join(" · ")
  }</p></div>`;
const messageBlock = (block: MessageBlock, changes: Changes): string => {
  switch (block.kind) {
    case "prose":
      return `<p>${text(block.text)}</p>`;
    case "tool":
      return toolActivity(block.label, block.duration, block.files);
    case "changes":
      return changeSummary(changes, block.description);
    case "status":
      return `<div class="mt-6 text-sm text-muted">${
        runStatus(block.text, block.tone)
      }</div>`;
  }
};
export const message = (item: Message, changes: Changes) =>
  `<article>${messageHeader(item)}${
    item.blocks.map((block) => messageBlock(block, changes)).join("")
  }</article>`;
export const transcript = (messages: Message[], changes: Changes) =>
  `<div data-component="transcript" class="mx-auto w-full max-w-transcript space-y-8 px-6 py-8">${
    messages.map((item) => message(item, changes)).join("")
  }</div>`;
export const composer = (model: string, reasoning: string) =>
  `<div data-component="composer" class="rounded-lg border border-line bg-surface p-4">
  <p class="min-h-12 text-muted">Ask a follow-up or steer the current run…</p>
  <div class="flex flex-wrap items-center justify-between gap-3 text-sm">${
    button({
      label: "Attach context",
      content: `${icon("plus")}Attach context`,
      variant: "quiet",
    })
  }<span class="ml-auto flex flex-wrap items-center gap-3">${
    selectorButton(model, reasoning)
  }${
    button({ label: "Stop", content: `Stop ${icon("stop", "small")}` })
  }</span></div>
</div>`;
export const conversationHeader = (
  title: string,
  presentation: "main" | "drawer",
) =>
  `<header class="flex shrink-0 items-center justify-between gap-3 border-b border-line ${
    presentation === "main" ? "h-16 px-6" : "h-12 pl-6 text-sm"
  }"><h2 class="min-w-0 truncate font-medium" title="${text(title)}">${
    text(title)
  }</h2>${
    presentation === "main"
      ? iconButton("dots-three", "Conversation options")
      : drawerControl("agent", true)
  }</header>`;
export const conversationPane = (
  title: string,
  messages: Message[],
  changes: Changes,
  model: string,
  reasoning: string,
  presentation: "main" | "drawer" = "main",
) =>
  `<section data-component="conversation-pane" class="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Agent conversation">${
    conversationHeader(title, presentation)
  }<div class="relative grid min-h-0 flex-1 grid-cols-1 conversation-rows"><div data-conversation-scroll class="col-start-1 row-span-2 row-start-1 min-h-0 overflow-y-auto pb-56">${
    transcript(messages, changes)
  }</div><div data-composer-overlay class="relative col-start-1 row-start-2 pb-6 pt-12 before:pointer-events-none before:absolute before:inset-0 before:overlay-glass before:composer-fade"><div aria-hidden="true" class="pointer-events-none absolute inset-0 composer-bottom-glass"></div><div class="relative mx-auto w-full max-w-transcript px-6">${
    composer(model, reasoning)
  }</div></div></div></section>`;
