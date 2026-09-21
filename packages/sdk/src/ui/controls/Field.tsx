import { type JSX, Show } from "solid-js";

/** The child control supplies the matching id and aria-describedby when needed. */
export function Field(props: {
  id: string;
  label: string;
  description?: string;
  error?: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div class="grid gap-2">
      <label for={props.id} class="type-dense">
        {props.label}
      </label>
      {props.children}
      <Show when={props.description}>
        <p id={`${props.id}-description`} class="type-description">
          {props.description}
        </p>
      </Show>
      <Show when={props.error}>
        <p id={`${props.id}-error`} role="alert" class="text-dense text-danger">
          {props.error}
        </p>
      </Show>
    </div>
  );
}
