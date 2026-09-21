import { type JSX, splitProps } from "solid-js";

/** Reference setting-switch: one native checkbox, the knob drawn by ::after. */
export function Switch(
  props: JSX.InputHTMLAttributes<HTMLInputElement> & { label: string },
): JSX.Element {
  const [local, rest] = splitProps(props, ["label", "class"]);

  return (
    <input
      type="checkbox"
      role="switch"
      aria-label={local.label}
      {...rest}
      class={`relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full border border-control-line bg-line checked:border-action checked:bg-action disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-muted after:content-[''] checked:after:translate-x-4 checked:after:bg-on-action ${local.class ?? ""}`}
    />
  );
}
