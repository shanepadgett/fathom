import type { JSX } from "solid-js";

export function Meter(props: {
  value: number;
  max: number;
  label: string;
}): JSX.Element {
  const maximum = () =>
    Number.isFinite(props.max) && props.max > 0 ? props.max : 1;

  const current = () =>
    Number.isFinite(props.value)
      ? Math.max(0, Math.min(maximum(), props.value))
      : 0;

  return (
    <span
      class="flex h-3 w-24 overflow-hidden rounded-sm bg-line"
      role="meter"
      aria-label={props.label}
      aria-valuemin="0"
      aria-valuemax={maximum()}
      aria-valuenow={current()}
    >
      <span
        class="bg-action"
        style={{ width: `${(current() / maximum()) * 100}%` }}
      />
    </span>
  );
}
