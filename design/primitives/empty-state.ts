import { html } from "lit";

export const emptyState = (message: string) =>
  html`<p class="px-3 py-6 text-sm text-muted">${message}</p>`;
