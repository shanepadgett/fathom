import { html } from "lit";

export const diffStat = (added: number, removed: number) =>
  html`
    <span class="inline-flex gap-1 font-mono text-sm"
    ><span class="text-success">+${added}</span><span class="text-danger">−${removed}</span></span>
  `;
