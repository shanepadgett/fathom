import "./control-frame.css";
import { type JSX, splitProps } from "solid-js";

export function Button(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement>,
): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <button
      type="button"
      class={`fathom-control ${local.class ?? ""}`}
      {...rest}
    />
  );
}
