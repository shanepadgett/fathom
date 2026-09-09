import type { DesignEntry } from "./design-entry.ts";

import { html, type TemplateResult } from "lit";

import { icon } from "../primitives/icon.ts";
import { components } from "./component-catalog.ts";
import { screens } from "./screen-catalog.ts";

const row =
  "viewer-nav-row flex min-h-8 min-w-0 items-center gap-2 rounded-control px-2 py-1.5 text-dense text-muted hover:bg-canvas hover:text-ink aria-[current=page]:bg-action/10 aria-[current=page]:font-medium aria-[current=page]:text-action";

const link = (href: string, label: string, fullLabel = label) => html`
  <a class="${row}" href="${href}" title="${fullLabel}" aria-label="${fullLabel}"
    ><span class="min-w-0 break-words">${label}</span></a
  >
`;

const group = (label: string, entries: DesignEntry[], path: string, open = false) => html`
  <details class="viewer-nav-group" ?open=${open}>
    <summary class="${row}">
      <span class="flex-1">${label}</span
      ><span class="font-mono text-micro text-muted">${entries.length}</span
      >${icon("caret-right", "small")}
    </summary>
    <div class="ml-4 grid gap-0.5 border-l border-line py-1 pl-2">
      ${entries.map((entry) =>
        link(
          `#/${path}/${entry.id}`,
          path === "screens" ? (entry.name.split(" · ")[1] ?? "Overview") : entry.name,
          entry.name,
        ),
      )}
    </div>
  </details>
`;

const section = (label: string, href: string, body: TemplateResult | TemplateResult[]) => html`
  <section class="mt-6">
    <h2 class="mb-2 px-2 text-dense font-semibold uppercase tracking-wide text-ink">
      <a class="hover:text-ink" href="${href}">${label}</a>
    </h2>
    <div class="grid gap-1">${body}</div>
  </section>
`;

export const viewerNavigation = () =>
  html`<div class="grid gap-1">${link("#/", "Overview")}${link("#/tokens", "Tokens")}</div>
    ${section(
      "Components",
      "#/components",
      (["Primitives", "Composites", "Behavior demos"] as const).map((category) =>
        group(
          category,
          components.filter((entry) => entry.category === category),
          "components",
        ),
      ),
    )}${section("Screens", "#/screens", [
      group(
        "Agent focus",
        screens.filter((entry) => entry.id.startsWith("agent-")),
        "screens",
        true,
      ),
      group(
        "Editor focus",
        screens.filter((entry) => entry.id.startsWith("editor-")),
        "screens",
        true,
      ),
      group(
        "Chat focus",
        screens.filter((entry) => entry.id.startsWith("chat-")),
        "screens",
        true,
      ),
    ])}`;

export function selectNavigation(host: HTMLElement, path: string) {
  for (const link of host.querySelectorAll<HTMLAnchorElement>("[data-nav] a")) {
    if (link.hash === `#${path}`) {
      link.setAttribute("aria-current", "page");
      let group = link.closest("details");
      while (group) {
        group.open = true;
        group = group.parentElement?.closest("details") ?? null;
      }
    } else link.removeAttribute("aria-current");
  }
}
