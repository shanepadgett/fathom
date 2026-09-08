import { html, type TemplateResult } from "lit";

import "../components/button.ts";

export interface ButtonOptions {
  label: string;
  content?: TemplateResult | string; // Trusted, authored markup only.
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
}: ButtonOptions) => html`
  <ds-button variant="${variant}" size="${size}"
    ><button type="button" aria-label="${label}" ?disabled=${disabled}>
      ${content ?? label}
    </button></ds-button
  >
`;
