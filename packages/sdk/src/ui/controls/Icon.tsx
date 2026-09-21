import type { JSX } from "solid-js";

export type IconName =
  | "arrow-counter-clockwise"
  | "clipboard"
  | "gear"
  | "sliders-horizontal"
  | "plugs"
  | "arrow-square-out"
  | "push-pin"
  | "archive"
  | "tree-structure"
  | "sidebar-simple"
  | "folder"
  | "folder-open"
  | "git-branch"
  | "chat-circle-text"
  | "robot"
  | "code"
  | "magnifying-glass"
  | "note-pencil"
  | "caret-down"
  | "caret-right"
  | "caret-double-right"
  | "caret-double-left"
  | "file-ts"
  | "file-text"
  | "brackets-curly"
  | "plus"
  | "spinner-gap"
  | "moon"
  | "stop"
  | "check"
  | "x"
  | "dots-three"
  | "arrow-left";

export const iconSizes = {
  small: "text-xs",
  normal: "text-base",
  large: "text-lg",
  toolbar: "text-xl",
} as const;

export function Icon(props: {
  name: IconName;
  size?: keyof typeof iconSizes;
}): JSX.Element {
  return (
    <i
      class={`ph ph-${props.name} shrink-0 ${iconSizes[props.size ?? "normal"]}`}
      aria-hidden="true"
    />
  );
}
