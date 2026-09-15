import { Icon } from "./icon.tsx";
import type { JSX } from "solid-js";

import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  Show,
} from "solid-js";

export function SearchList<T>(props: {
  items: T[];
  label: string;
  placeholder: string;
  empty: string;
  heading?: string;
  action?: string;
  scope?: string;
  disabled?: boolean;
  rowClass?(active: boolean): string;
  searchText(item: T): string;
  select(item: T): unknown;
  children(item: T): JSX.Element;
}) {
  const [query, setQuery] = createSignal("");
  const [selected, setSelected] = createSignal(0);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const id = createUniqueId();
  let input!: HTMLInputElement;
  const matches = createMemo(() =>
    props.items.filter((item) =>
      props.searchText(item).toLowerCase().includes(
        query().trim().toLowerCase(),
      )
    )
  );
  const active = () => Math.min(selected(), Math.max(0, matches().length - 1));
  let frame = 0;
  createEffect(() => {
    const option = `${id}-${active()}`;
    matches();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() =>
      document.getElementById(option)?.scrollIntoView({ block: "nearest" })
    );
  });
  onCleanup(() => cancelAnimationFrame(frame));
  async function choose(item: T) {
    if (busy() || props.disabled) return;
    setBusy(true);
    setError("");
    try {
      await props.select(item);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
      if (input.isConnected) input.focus();
    }
  }
  return (
    <>
      <div class="flex h-14 items-center gap-3 px-5 text-sm text-muted">
        <Icon name="magnifying-glass" />
        <input
          class="search-surface-input h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-sm text-ink shadow-none outline-none"
          ref={input}
          autofocus
          role="combobox"
          aria-expanded="true"
          aria-controls={id}
          aria-autocomplete="list"
          aria-activedescendant={matches().length
            ? `${id}-${active()}`
            : undefined}
          aria-label={props.label}
          placeholder={props.placeholder}
          value={query()}
          readOnly={busy() || props.disabled}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setSelected(0);
          }}
          onKeyDown={(event) => {
            if (event.isComposing || busy() || props.disabled) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const count = matches().length;
              if (count) {
                setSelected(
                  (active() + (event.key === "ArrowDown" ? 1 : count - 1)) %
                    count,
                );
              }
            } else if (event.key === "Enter") {
              event.preventDefault();
              const item = matches()[active()];
              if (item !== undefined) void choose(item);
            }
          }}
        />
        <Show when={props.scope}>
          <span class="shrink-0 text-xs">{props.scope}</span>
        </Show>
      </div>
      <div class="px-2 pb-2">
        <h3 class="px-3 py-2 text-xs font-normal text-muted">
          {props.heading ?? props.label}
        </h3>
        <div
          id={id}
          role="listbox"
          aria-label={props.label}
          aria-busy={busy() || props.disabled}
          class="max-h-[min(24rem,calc(100dvh-15rem))] overflow-auto"
        >
          <For each={matches()}>
            {(item, index) => (
              <button
                id={`${id}-${index()}`}
                type="button"
                role="option"
                aria-selected={index() === active()}
                disabled={busy() || props.disabled}
                class={props.rowClass?.(index() === active()) ??
                  `flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm ${
                    index() === active()
                      ? "bg-surface text-ink"
                      : "text-ink hover:bg-surface"
                  }`}
                onPointerMove={() => setSelected(index())}
                onClick={() => void choose(item)}
              >
                {props.children(item)}
              </button>
            )}
          </For>
          <Show when={!matches().length}>
            <p class="px-3 py-4 text-sm text-muted">{props.empty}</p>
          </Show>
        </div>
      </div>
      <Show when={error()}>
        <p role="alert" class="mt-3 text-sm text-danger">{error()}</p>
      </Show>
      <footer class="flex h-9 items-center gap-4 border-t border-line bg-surface px-4 text-micro text-muted">
        <span class="flex items-center gap-1">
          <kbd class="rounded-sm bg-line px-1">↑</kbd>
          <kbd class="rounded-sm bg-line px-1">↓</kbd> Navigate
        </span>
        <span class="flex items-center gap-1">
          <kbd class="rounded-sm bg-line px-1">Enter</kbd>{" "}
          {props.action ?? "Select"}
        </span>
        <span class="flex items-center gap-1">
          <kbd class="rounded-sm bg-line px-1">Esc</kbd> Close
        </span>
      </footer>
    </>
  );
}
