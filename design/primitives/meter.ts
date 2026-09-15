import { html } from "lit";

export const meter = (value: number, max: number, label: string) => {
  const maximum = Number.isFinite(max) && max > 0 ? max : 1;
  const current = Number.isFinite(value)
    ? Math.max(0, Math.min(maximum, value))
    : 0;
  // Percentage is derived data, not a design dimension.
  return html`
    <span
      class="flex h-3 w-24 overflow-hidden rounded-sm bg-line"
      role="meter"
      aria-label="${label}"
      aria-valuemin="0"
      aria-valuemax="${maximum}"
      aria-valuenow="${current}"
    ><span class="bg-action" style="width:${(current / maximum) * 100}%"></span
    ></span>
  `;
};
