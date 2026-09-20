import { html, type TemplateResult } from "lit";

export const settingRow = (
  label: string,
  description: string,
  control: TemplateResult,
) =>
  html`
    <label class="setting-row" data-setting=${label}>
      <span><span class="block text-sm font-medium">${label}</span><span class="mt-1 block text-dense text-muted">${description}</span></span>
      ${control}
    </label>
  `;

export const settingSwitch = (checked = false) =>
  html`
    <input class="setting-switch" type="checkbox" role="switch"
      .checked=${checked} />
  `;

export const settingSelect = (options: string[]) =>
  html`
    <select class="setting-input">${options.map((option) =>
      html`<option>${option}</option>`
    )}</select>
  `;

export const settingInput = (value: string, type = "text") =>
  html`
    <input class="setting-input" type=${type} .value=${value} />
  `;
