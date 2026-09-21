import { type JSX, splitProps } from "solid-js";

export function Textarea(
  props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>,
): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <textarea
      {...rest}
      class={`w-full min-w-0 resize-y rounded-control border border-control-line bg-canvas px-3 py-2 text-dense text-ink disabled:opacity-50 ${local.class ?? ""}`}
    />
  );
}
