import { Show } from "solid-js";

import { Button } from "./primitives.tsx";
import { Icon } from "./icon.tsx";

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
          <span class="text-muted">{" · "}{props.secondary}</span>
        </Show>
      </span>
      <Icon name="caret-down" size="small" />
    </Button>
  );
}
