import { createEffect, For, onCleanup, Show, type JSX } from "solid-js";
import { Button } from "./Button.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { anchorPosition } from "./anchor-position.ts";
import { rovingFocus } from "./roving-focus.ts";

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
}

export interface MenuSection {
  items: MenuItem[];
}

/** Popover menu anchored to its trigger; Escape and light dismiss close it. */
export function Menu(props: {
  label: string;
  sections: MenuSection[];
  anchor?: HTMLElement;
  open: boolean;
  onClose: () => void;
  onSelect: (item: MenuItem) => void;
}): JSX.Element {
  let menu!: HTMLDivElement;
  let stopPositioning: (() => void) | undefined;

  const shown = () => menu.matches(":popover-open");

  createEffect(() => {
    if (props.open && !shown()) {
      menu.showPopover();

      stopPositioning = props.anchor
        ? anchorPosition(menu, props.anchor)
        : undefined;

      menu.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    } else if (!props.open && shown()) {
      menu.hidePopover();
    }
  });

  createEffect(() => onCleanup(rovingFocus(menu, "[role=menuitem]")));

  onCleanup(() => {
    stopPositioning?.();

    if (shown()) {
      menu.hidePopover();
    }
  });

  return (
    <div
      ref={(element) => {
        menu = element;
      }}
      role="menu"
      aria-label={props.label}
      popover="auto"
      class="fathom-menu"
      onToggle={(event) => {
        if (event.newState === "closed" && props.open) {
          stopPositioning?.();
          stopPositioning = undefined;
          props.onClose();
          props.anchor?.focus();
        }
      }}
    >
      <For each={props.sections}>
        {(section, index) => (
          <>
            <Show when={index() > 0}>
              <div role="separator" class="my-1 border-t border-line" />
            </Show>
            <div role="group">
              <For each={section.items}>
                {(item) => (
                  <Button
                    variant="quiet"
                    role="menuitem"
                    class="fathom-menu-action"
                    onClick={() => {
                      props.onSelect(item);
                      menu.hidePopover();
                    }}
                  >
                    <Show when={item.icon}>
                      {(name) => <Icon name={name()} />}
                    </Show>
                    <span>{item.label}</span>
                  </Button>
                )}
              </For>
            </div>
          </>
        )}
      </For>
    </div>
  );
}
