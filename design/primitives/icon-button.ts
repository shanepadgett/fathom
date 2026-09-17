import { html, nothing } from "lit";

import "./button.ts";
import { icon, type IconName } from "./icon.ts";

export const iconButton = (
  name: IconName,
  label: string,
  options: {
    sidebarToggle?: boolean;
    toolbar?: boolean;
  } = {},
) => html`
  <ds-button variant="quiet" size="small" icon-only
    ><button
      type="button"
      aria-label="${label}"
      title="${label}"
      ?data-sidebar-toggle=${options.sidebarToggle}
      aria-expanded=${options.sidebarToggle ? "true" : nothing}
    >
      ${icon(name, options.toolbar ? "toolbar" : "normal")}
    </button></ds-button
  >
`;
