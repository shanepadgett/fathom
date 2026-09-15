import type { IconName } from "./icon.tsx";

import {
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onMount,
} from "solid-js";

import { Icon } from "./icon.tsx";
import { occludeNativeSurfaces } from "../state/native-surfaces.ts";

export interface MenuAction {
  label: string;
  icon: IconName;
  disabled?: boolean;
  run(): void;
}

export function ActionMenu(props: { label: string; actions: MenuAction[] }) {
  const id = createUniqueId();
  const [menuOpen, setMenuOpen] = createSignal(false);
  occludeNativeSurfaces(menuOpen);
  let trigger!: HTMLButtonElement;
  let menu!: HTMLDivElement;
  const isOpen = () => menu.matches(":popover-open");
  const buttons = () => [
    ...menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
  ];
  const close = (focus = false) => {
    if (isOpen()) menu.hidePopover();
    if (focus) trigger.focus();
  };
  function position() {
    if (!isOpen()) return;
    const anchor = trigger.getBoundingClientRect();
    const bounds = menu.getBoundingClientRect();
    const gap = 4;
    const inset = 8;
    const left = Math.max(
      inset,
      Math.min(anchor.right - bounds.width, innerWidth - bounds.width - inset),
    );
    const below = anchor.bottom + gap;
    const top = below + bounds.height <= innerHeight - inset
      ? below
      : Math.max(inset, anchor.top - gap - bounds.height);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }
  const open = () => {
    if (!isOpen()) menu.showPopover();
    position();
  };
  onMount(() => {
    const toggle = (event: Event) =>
      setMenuOpen((event as ToggleEvent).newState === "open");
    menu.addEventListener("beforetoggle", toggle);
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    onCleanup(() => {
      menu.removeEventListener("beforetoggle", toggle);
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
    });
  });
  function navigate(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen()) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    open();
    const items = buttons();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
      ? items.length - 1
      : index < 0
      ? event.key === "ArrowUp" ? items.length - 1 : 0
      : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
        items.length;
    items[next]?.focus();
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-control text-muted hover:bg-canvas hover:text-ink"
        aria-label={props.label}
        aria-haspopup="menu"
        popovertarget={id}
        onKeyDown={navigate}
        onClick={(event) => {
          event.preventDefault();
          if (isOpen()) close();
          else open();
        }}
      >
        <Icon name="dots-three" />
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        class="context-menu inset-auto max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto"
        role="menu"
        aria-label={props.label}
        onKeyDown={navigate}
      >
        <For each={props.actions}>
          {(action) => (
            <button
              type="button"
              role="menuitem"
              class="context-menu-action inline-flex items-center rounded-control border border-transparent bg-transparent text-muted hover:text-ink disabled:opacity-40"
              disabled={action.disabled}
              onClick={() => {
                close(true);
                action.run();
              }}
            >
              <Icon name={action.icon} />
              <span>{action.label}</span>
            </button>
          )}
        </For>
      </div>
    </>
  );
}
