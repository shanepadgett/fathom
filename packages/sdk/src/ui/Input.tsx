import "./control-frame.css";
import { type JSX, splitProps } from "solid-js";

export function Input(
  props: JSX.InputHTMLAttributes<HTMLInputElement>,
): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);

  return <input class={`fathom-control ${local.class ?? ""}`} {...rest} />;
}
