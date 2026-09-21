import { For } from "solid-js";
import type { Registry } from "@fathom/sdk";
import {
  createSlotEntries,
  Slot,
  type NamedContribution,
} from "@fathom/sdk/ui";
import { EmptyState, IconButton, NavItem } from "@fathom/sdk/ui";

export function SettingsPage(props: {
  sections: Registry<NamedContribution>;
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const entries = createSlotEntries(() => props.sections);

  return (
    <div class="flex h-dvh min-w-0 flex-col bg-canvas">
      <header class="flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
        <span class="type-wordmark">
          Fathom<span class="text-action dark:text-teal-200">.</span>
        </span>
        <IconButton
          icon="x"
          label="Close settings"
          toolbar
          onClick={() => props.onClose()}
        />
      </header>
      <div class="flex min-h-0 flex-1">
        <nav
          aria-label="Settings"
          class="w-48 shrink-0 overflow-auto border-r border-line bg-surface"
        >
          <For each={entries()}>
            {(entry) => (
              <NavItem
                label={entry.value.label}
                icon={entry.value.icon}
                aria-current={props.selected === entry.id ? "page" : undefined}
                onClick={() => props.onSelect(entry.id)}
              />
            )}
          </For>
        </nav>
        <main class="min-w-0 flex-1 overflow-y-auto">
          <Slot
            registry={props.sections}
            context={{}}
            mode="keyed"
            selected={props.selected}
            fallback={
              <EmptyState>
                Its plugin may be disabled. Choose another section.
              </EmptyState>
            }
          />
        </main>
      </div>
    </div>
  );
}
