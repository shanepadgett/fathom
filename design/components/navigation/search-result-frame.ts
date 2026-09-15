import { html, type TemplateResult } from "lit";

export const resultFrame = (
  leading: TemplateResult,
  body: TemplateResult,
  trailing: string,
  selected: boolean,
) => html`
  <div class="flex items-center gap-3 rounded-control px-3 py-2.5 ${selected ? "bg-surface" : ""}">
    ${leading}
    <div class="min-w-0 flex-1">${body}</div>
    <span class="shrink-0 text-xs text-muted">${trailing}</span>
  </div>
`;
