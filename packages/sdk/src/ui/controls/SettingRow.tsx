import type { JSX } from "solid-js";

/** Reference setting row: label and description left, control right. */
export function SettingRow(props: {
  label: string;
  description: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <label class="flex min-h-20 items-center justify-between gap-6 border-b border-line py-4 last:border-b-0">
      <span>
        <span class="block type-label">{props.label}</span>
        <span class="mt-1 block type-description">{props.description}</span>
      </span>
      {props.children}
    </label>
  );
}
