import { html } from "lit";

export interface TabItem {
  id: string;
  label: string;
}

export const tab = (item: TabItem, selected: string) => html`
  <button
    type="button"
    aria-pressed="${item.id === selected}"
    class="flex flex-1 items-center justify-center border-t-2 ${
      item.id === selected
        ? "border-action bg-canvas text-ink"
        : "border-transparent text-muted hover:text-ink"
    }"
  >
    ${item.label}
  </button>
`;

export const tabStrip = (items: TabItem[], selected: string, label: string) => html`
  <div class="flex h-9 shrink-0 border-b border-line text-sm" role="group" aria-label="${label}">
    ${items.map((item) => tab(item, selected))}
  </div>
`;
