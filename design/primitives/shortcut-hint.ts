import { html } from "lit";

const keycap = (key: string) => html`<kbd class="rounded-sm bg-line px-1">${key}</kbd>`;

export const shortcutHint = (keys: string[], action: string) =>
  html`<span class="flex items-center gap-1">${keys.map(keycap)} ${action}</span>`;
