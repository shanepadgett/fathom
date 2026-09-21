import {
  createComponent,
  ErrorBoundary,
  For,
  type JSX,
  useContext,
} from "solid-js";
import type { Registry } from "../registry.ts";
import type { Contribution } from "./slot-contract.ts";
import { SlotsContext } from "./slot-context.ts";
import { createSlotEntries } from "./create-slot-entries.ts";

/** Lists render all visible entries. Single/keyed outlets never elect an arbitrary entry. */
export function Slot<C extends Record<string, unknown>>(props: {
  registry: Registry<Contribution<C>>;
  context: C;
  mode?: "list" | "single" | "keyed";
  selected?: string;
  defaultId?: string;
  fallback?: JSX.Element;
}): JSX.Element {
  const settings = useContext(SlotsContext);
  const entries = createSlotEntries(() => props.registry);

  const visible = () => {
    if (!props.mode || props.mode === "list") {
      return entries();
    }

    const id =
      props.mode === "keyed"
        ? props.selected
        : (settings?.().selected?.[props.registry.id] ?? props.defaultId);

    return entries().filter((entry) => entry.id === id);
  };

  return (
    <For each={visible()} fallback={props.fallback}>
      {(entry) => (
        <ErrorBoundary
          fallback={
            <p role="alert" class="p-4 text-sm text-danger">
              This view failed. Reload its plugin from Plugin recovery.
            </p>
          }
        >
          {createComponent(entry.value.component, props.context)}
        </ErrorBoundary>
      )}
    </For>
  );
}
