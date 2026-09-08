import { html } from "lit";

export type IconName =
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
  | "dots-three";

const iconSizes = {
  small: "text-xs",
  normal: "text-base",
  large: "text-lg",
  toolbar: "text-xl",
};

export const icon = (name: IconName, size: keyof typeof iconSizes = "normal") =>
  html`<i class="ph ph-${name} shrink-0 ${iconSizes[size]}" aria-hidden="true"></i>`;
