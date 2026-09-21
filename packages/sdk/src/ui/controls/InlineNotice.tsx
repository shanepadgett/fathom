import type { JSX } from "solid-js";

export function InlineNotice(props: {
  error?: boolean;
  children: JSX.Element;
}): JSX.Element {
  return (
    <p
      role={props.error ? "alert" : "status"}
      class={`break-words type-dense ${
        props.error ? "text-danger" : "text-muted"
      }`}
    >
      {props.children}
    </p>
  );
}
