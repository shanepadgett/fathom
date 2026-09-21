import { type JSX, splitProps } from "solid-js";

export function Checkbox(
  props: JSX.InputHTMLAttributes<HTMLInputElement>,
): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <input
      type="checkbox"
      {...rest}
      class={`h-4 w-4 shrink-0 accent-action disabled:opacity-50 ${local.class ?? ""}`}
    />
  );
}
