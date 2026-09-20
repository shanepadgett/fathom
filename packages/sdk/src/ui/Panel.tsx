import "./Panel.css";
import { type JSX, splitProps } from "solid-js";

export function Panel(props: JSX.HTMLAttributes<HTMLElement>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);

  return <section class={`fathom-panel ${local.class ?? ""}`} {...rest} />;
}
