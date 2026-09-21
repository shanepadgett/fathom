import { type JSX, splitProps } from "solid-js";
import { Button } from "./Button.tsx";
import { Icon, type IconName } from "./Icon.tsx";

/** Reference icon-button: quiet, small, icon-only, always labelled. */
export function IconButton(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    icon: IconName;
    toolbar?: boolean;
    sidebarToggle?: boolean;
  },
): JSX.Element {
  const [local, rest] = splitProps(props, [
    "label",
    "icon",
    "toolbar",
    "sidebarToggle",
  ]);

  return (
    <Button
      variant="quiet"
      size="small"
      iconOnly
      {...rest}
      aria-label={local.label}
      title={local.label}
      data-sidebar-toggle={local.sidebarToggle ? "" : undefined}
    >
      <Icon name={local.icon} size={local.toolbar ? "toolbar" : "normal"} />
    </Button>
  );
}
