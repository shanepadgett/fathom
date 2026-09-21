import { Show, type JSX } from "solid-js";

/**
 * The frame every settings section renders inside: centered column, page
 * padding, and an optional heading with description.
 */
export function SettingsSection(props: {
  title?: string;
  description?: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div class="mx-auto w-full max-w-3xl px-10 py-8">
      <Show when={props.title}>
        <header class="mb-6">
          <h1 class="type-title">{props.title}</h1>
          <Show when={props.description}>
            <p class="type-description mt-3">{props.description}</p>
          </Show>
        </header>
      </Show>
      {props.children}
    </div>
  );
}
