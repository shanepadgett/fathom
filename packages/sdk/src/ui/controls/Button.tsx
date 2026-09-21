import { type JSX, splitProps } from "solid-js";

export type ButtonVariant = "primary" | "secondary" | "quiet";
export type ButtonSize = "compact" | "small" | "normal";

/** Reference button; variant and size resolve in Button.css, not here. */
export function Button(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    iconOnly?: boolean;
  },
): JSX.Element {
  const [local, rest] = splitProps(props, [
    "class",
    "variant",
    "size",
    "iconOnly",
  ]);

  return (
    <button
      type="button"
      {...rest}
      class={`fathom-button ${local.class ?? ""}`}
      data-variant={local.variant ?? "secondary"}
      data-size={local.size ?? "compact"}
      data-icon-only={local.iconOnly ? "" : undefined}
    />
  );
}
