import { Show } from "solid-js";

import { Icon } from "./icon.tsx";
import { Button } from "./primitives.tsx";

export function SelectorButton(props: {
  value: string;
  secondary?: string;
  label: string;
  disabled?: boolean;
  onClick(): void;
}) {
  return (
    <Button
      variant="secondary"
      disabled={props.disabled}
      aria-label={props.label}
      onClick={props.onClick}
    >
      <span>
        {props.value}
        <Show when={props.secondary}>
          <span class="text-muted">
            {" · "}
            {props.secondary}
          </span>
        </Show>
      </span>
      <Icon name="caret-down" size="small" />
    </Button>
  );
}
