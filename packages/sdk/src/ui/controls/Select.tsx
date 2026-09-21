import { type JSX, splitProps } from "solid-js";

export function Select(
  props: JSX.SelectHTMLAttributes<HTMLSelectElement>,
): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <select
      {...rest}
      class={`min-h-9 min-w-0 rounded-control border border-control-line bg-canvas px-3 py-2 text-dense text-ink disabled:opacity-50 ${local.class ?? ""}`}
    />
  );
}
