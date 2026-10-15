import { html } from "lit";

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
  | "folders"
  | "folder-plus"
  | "arrow-square-in"
  | "cloud-arrow-down"
  | "terminal-window"
  | "link"
  | "sparkle"
  | "lock-simple"
  | "pencil-simple"
  | "flask"
  | "file-code"
  | "square"
  | "check-square"
  | "arrow-right"
  | "dots-six-vertical"
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
  | "dots-three";

const iconSizes = {
  small: "text-xs",
  normal: "text-base",
  large: "text-lg",
  toolbar: "text-xl",
};

export const icon = (name: IconName, size: keyof typeof iconSizes = "normal") =>
  html`<i class="ph ph-${name} shrink-0 ${
    iconSizes[size]
  }" aria-hidden="true"></i>`;
