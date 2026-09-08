import { icon, type IconName, text } from "./content.ts";
export interface ButtonOptions {
  label: string;
  content?: string; // Trusted, authored markup only.
  variant?: "primary" | "secondary" | "quiet";
  size?: "compact" | "small" | "normal";
  disabled?: boolean;
}
export const button = ({
  label,
  content,
  variant = "secondary",
  size = "compact",
  disabled = false,
}: ButtonOptions) =>
  `<ds-button variant="${variant}" size="${size}"><button type="button" aria-label="${text(
    label,
  )}" ${disabled ? "disabled" : ""}>${content ?? text(label)}</button></ds-button>`;
export const iconButton = (
  name: IconName,
  label: string,
  options: { sidebarToggle?: boolean; toolbar?: boolean } = {},
) =>
  `<ds-button variant="quiet" size="small" icon-only><button type="button" aria-label="${text(
    label,
  )}" title="${text(label)}" ${
    options.sidebarToggle ? 'data-sidebar-toggle aria-expanded="true"' : ""
  }>${icon(name, options.toolbar ? "toolbar" : "normal")}</button></ds-button>`;
export const projectSelector = (label: string) =>
  `<ds-button variant="secondary" size="project"><button type="button">${icon(
    "folder",
  )}<span class="flex-1 text-left">${text(label)}</span>${icon("caret-down")}</button></ds-button>`;
export const selectorButton = (value: string, secondary = "") =>
  button({
    label: secondary ? `${value}, ${secondary}` : value,
    content: `<span>${text(value)}${
      secondary ? ` <span class="text-muted">· ${text(secondary)}</span>` : ""
    }</span>${icon("caret-down", "small")}`,
  });
export interface TabItem {
  id: string;
  label: string;
}
export const tab = (item: TabItem, selected: string) =>
  `<button type="button" aria-pressed="${
    item.id === selected
  }" class="flex flex-1 items-center justify-center border-t-2 ${
    item.id === selected
      ? "border-action bg-canvas text-ink"
      : "border-transparent text-muted hover:text-ink"
  }">${text(item.label)}</button>`;
export const tabStrip = (items: TabItem[], selected: string, label: string) =>
  `<div class="flex h-9 shrink-0 border-b border-line text-sm" role="group" aria-label="${text(
    label,
  )}">${items.map((item) => tab(item, selected)).join("")}</div>`;
export const searchFieldPreview = (placeholder: string, searchIcon = false, scope = "") =>
  `<div class="flex h-14 items-center gap-3 px-5 text-sm text-muted">${
    searchIcon ? icon("magnifying-glass") : ""
  }<span class="flex min-w-0 items-center" data-search-prompt><span class="h-5 w-px shrink-0 bg-action" aria-hidden="true"></span><span class="truncate">${text(
    placeholder,
  )}</span></span>${
    scope ? `<span class="ml-auto shrink-0 text-xs">${text(scope)}</span>` : ""
  }</div>`;

/** Static drawer affordance shared by workspace and drawer title bars. */
export const drawerControl = (kind: "agent" | "diff", open = false) =>
  `<button type="button" aria-label="${open ? "Close" : "Open"} ${kind} drawer" title="${
    open ? "Close" : "Open"
  } ${kind} drawer" class="flex h-full w-12 shrink-0 items-center justify-center border-l border-line ${
    open ? "bg-action text-on-action" : "text-action hover:bg-canvas"
  }">${icon(open ? "caret-double-right" : "caret-double-left", "toolbar")}</button>`;
