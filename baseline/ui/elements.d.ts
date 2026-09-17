import type { JSX } from "solid-js";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "workspace-layout": JSX.HTMLAttributes<HTMLElement>;
      "workspace-sidebar": JSX.HTMLAttributes<HTMLElement> & {
        placement?: string;
      };
      "session-sidebar": JSX.HTMLAttributes<HTMLElement>;
      "ds-button": JSX.HTMLAttributes<HTMLElement> & {
        variant?: string;
        size?: string;
        "icon-only"?: boolean | "";
      };
    }
  }
}
