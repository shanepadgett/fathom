import { components, type DesignEntry, screens } from "../navigation.ts";
import { icon, type IconName, text } from "../primitives/content.ts";

const row =
  "viewer-nav-row flex min-h-8 min-w-0 items-center gap-2 rounded-control px-2 py-1.5 text-dense text-muted hover:bg-canvas hover:text-ink aria-[current=page]:bg-action/10 aria-[current=page]:font-medium aria-[current=page]:text-action";

const link = (href: string, label: string, symbol?: IconName, fullLabel = label) =>
  `<a class="${row}" href="${text(href)}" title="${text(
    fullLabel,
  )}" aria-label="${text(fullLabel)}">${
    symbol ? icon(symbol) : ""
  }<span class="min-w-0 break-words">${text(label)}</span></a>`;

const group = (
  label: string,
  symbol: IconName,
  entries: DesignEntry[],
  path: string,
  open = false,
) =>
  `<details class="viewer-nav-group" ${open ? "open" : ""}>
    <summary class="${row}">${icon(symbol)}<span class="flex-1">${text(
      label,
    )}</span><span class="font-mono text-micro text-muted">${entries.length}</span>${icon(
      "caret-right",
      "small",
    )}</summary>
    <div class="ml-4 grid gap-0.5 border-l border-line py-1 pl-2">${entries
      .map((entry) =>
        link(
          `#/${path}/${entry.id}`,
          path === "screens" ? (entry.name.split(" · ")[1] ?? "Overview") : entry.name,
          undefined,
          entry.name,
        ),
      )
      .join("")}</div>
  </details>`;

const section = (label: string, href: string, body: string) =>
  `<section class="mt-6"><h2 class="mb-2 px-2 text-micro font-medium uppercase tracking-widest text-muted"><a class="hover:text-ink" href="${href}">${label}</a></h2><div class="grid gap-1">${body}</div></section>`;

export const viewerNavigation = () =>
  `<div class="grid gap-1">${link("#/", "Overview", "folder-open")}${link(
    "#/tokens",
    "Tokens",
    "brackets-curly",
  )}</div>${section(
    "Components",
    "#/components",
    (["Primitives", "Composites", "Behavior demos"] as const)
      .map((category, index) =>
        group(
          category,
          (["brackets-curly", "folder", "note-pencil"] as const)[index],
          components.filter((entry) => entry.category === category),
          "components",
        ),
      )
      .join(""),
  )}${section(
    "Screens",
    "#/screens",
    group(
      "Agent focus",
      "chat-circle-text",
      screens.filter((entry) => entry.id.startsWith("agent-")),
      "screens",
      true,
    ) +
      group(
        "Editor focus",
        "code",
        screens.filter((entry) => entry.id.startsWith("editor-")),
        "screens",
        true,
      ),
  )}`;
