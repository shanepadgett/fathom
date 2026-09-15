import type { IconName } from "../../sdk/icons.ts";

export type { IconName } from "../../sdk/icons.ts";

type IconProps = {
  name: IconName;
  size?: keyof typeof iconSizes;
};

const iconSizes = {
  small: "text-xs",
  normal: "text-base",
  large: "text-lg",
  toolbar: "text-xl",
};

export const Icon = (props: IconProps) => (
  <i
    class={`ph ph-${props.name} shrink-0 ${iconSizes[props.size ?? "normal"]}`}
    aria-hidden="true"
  />
);
