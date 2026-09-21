import { type JSX, Show, splitProps } from "solid-js";
import { Icon, type IconName } from "./Icon.tsx";

/** Reference settings-nav-item; aria-current="page" marks the active row. */
export function NavItem(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    icon?: IconName;
    trailing?: JSX.Element;
  },
): JSX.Element {
  const [local, rest] = splitProps(props, [
    "class",
    "label",
    "icon",
    "trailing",
  ]);

  return (
    <button
      type="button"
      {...rest}
      class={`flex min-h-12 w-full items-center gap-3 border-b border-line px-4 py-3 text-left type-dense text-muted hover:bg-surface hover:text-ink aria-[current=page]:bg-action/10 aria-[current=page]:font-medium aria-[current=page]:text-action ${local.class ?? ""}`}
    >
      <Show when={local.icon}>{(name) => <Icon name={name()} />}</Show>
      <span class="flex-1">{local.label}</span>
      {local.trailing}
    </button>
  );
}
