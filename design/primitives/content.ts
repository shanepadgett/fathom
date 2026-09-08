/** Plain text and attribute values must cross this boundary; slots are authored HTML. */
export const text = (value: string | number) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export type IconName =
  | "sidebar-simple"
  | "folder"
  | "folder-open"
  | "git-branch"
  | "chat-circle-text"
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
  `<i class="ph ph-${name} shrink-0 ${iconSizes[size]}" aria-hidden="true"></i>`;

export type Tone = "neutral" | "action" | "success" | "warning" | "danger";
export const tones: Record<Tone, string> = {
  neutral: "text-muted",
  action: "text-action",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};
const dots: Record<Tone, string> = {
  neutral: "bg-muted",
  action: "bg-action",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};
export const statusDot = (tone: Tone, label = "", small = false) =>
  `<span class="shrink-0 rounded-full ${small ? "h-1.5 w-1.5" : "h-2 w-2"} ${dots[tone]}" ${
    label ? `role="img" aria-label="${text(label)}"` : 'aria-hidden="true"'
  }></span>`;
export type GitStatus = "A" | "M" | "D" | "R" | "?";
const gitStatuses: Record<GitStatus, [string, Tone]> = {
  A: ["Added", "success"],
  M: ["Modified", "action"],
  D: ["Deleted", "danger"],
  R: ["Renamed", "action"],
  "?": ["Untracked", "neutral"],
};
export const changeStatus = (status?: GitStatus) =>
  status
    ? `<span class="shrink-0 text-micro ${
        tones[gitStatuses[status][1]]
      }" aria-label="${gitStatuses[status][0]}">${status}</span>`
    : "";
export const diffStat = (added: number, removed: number) =>
  `<span class="inline-flex gap-1 font-mono text-sm"><span class="text-success">+${text(
    added,
  )}</span><span class="text-danger">−${text(removed)}</span></span>`;
export const meter = (value: number, max: number, label: string) => {
  const maximum = Number.isFinite(max) && max > 0 ? max : 1;
  const current = Number.isFinite(value) ? Math.max(0, Math.min(maximum, value)) : 0;
  // Percentage is derived data, not a design dimension.
  return `<span class="flex h-3 w-24 overflow-hidden rounded-sm bg-line" role="meter" aria-label="${text(
    label,
  )}" aria-valuemin="0" aria-valuemax="${maximum}" aria-valuenow="${current}"><span class="bg-action" style="width:${
    (current / maximum) * 100
  }%"></span></span>`;
};
export const keycap = (key: string) => `<kbd class="rounded-sm bg-line px-1">${text(key)}</kbd>`;
export const shortcutHint = (keys: string[], action: string) =>
  `<span class="flex items-center gap-1">${keys.map(keycap).join("")} ${text(action)}</span>`;
export const emptyState = (message: string) =>
  `<p class="px-3 py-6 text-sm text-muted">${text(message)}</p>`;
