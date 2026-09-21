import type { JSX } from "solid-js";

export type Tone = "neutral" | "action" | "success" | "warning" | "danger";

const dots: Record<Tone, string> = {
  neutral: "bg-muted",
  action: "bg-action",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/** Labelled dots announce state; decorative dots stay hidden from assistive tech. */
export function StatusDot(props: {
  tone: Tone;
  label?: string;
  small?: boolean;
}): JSX.Element {
  return (
    <span
      class={`shrink-0 rounded-full ${
        props.small ? "h-1.5 w-1.5" : "h-2 w-2"
      } ${dots[props.tone]}`}
      role={props.label ? "img" : undefined}
      aria-label={props.label || undefined}
      aria-hidden={props.label ? undefined : "true"}
    />
  );
}
