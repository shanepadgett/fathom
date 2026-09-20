import type { TemplateResult } from "lit";

import { html } from "lit";

/** Non-interactive compact label; owners supply text or authored content. */
export const chip = (content: string | TemplateResult, detail = "") =>
  html`
    <span
      class="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-control-line bg-surface px-3 py-2 text-sm"
      title=${detail}>${content}</span>
  `;
