import { type JSX, splitProps } from "solid-js";

/**
 * Reference settings card. `content` pads all sides for standalone content;
 * `rows` pads only the sides so SettingRow borders run edge to edge.
 */
export function Card(
  props: JSX.HTMLAttributes<HTMLElement> & {
    padding?: "content" | "rows";
  },
): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "padding"]);

  return (
    <section
      {...rest}
      class={`rounded-lg border border-line bg-surface ${
        local.padding === "rows" ? "px-5" : "p-5"
      } ${local.class ?? ""}`}
    />
  );
}
