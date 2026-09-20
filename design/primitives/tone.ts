export type Tone = "neutral" | "action" | "success" | "warning" | "danger";

export const tones: Record<Tone, string> = {
  neutral: "text-muted",
  action: "text-action",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};
