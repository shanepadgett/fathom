import type { Tone } from "./tone.ts";

import { html, nothing } from "lit";

const dots: Record<Tone, string> = {
  neutral: "bg-muted",
  action: "bg-action",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export const statusDot = (tone: Tone, label = "", small = false) => html`
  <span
    class="shrink-0 rounded-full ${small ? "h-1.5 w-1.5" : "h-2 w-2"} ${dots[tone]}"
    role=${label ? "img" : nothing}
    aria-label=${label || nothing}
    aria-hidden=${label ? nothing : "true"}
  ></span>
`;
