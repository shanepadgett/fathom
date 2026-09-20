import {
  createComponent,
  createEffect,
  createSignal,
  ErrorBoundary,
  For,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js";
import type { Entry, Registry } from "../registry.ts";
import type { Contribution } from "./slot-contract.ts";
import { SlotsContext } from "./slot-context.ts";

/** Render visible contributions in composition order. Requires a host renderer. */
export function Slot<C extends Record<string, unknown>>(props: {
  registry: Registry<Contribution<C>>;
  context: C;
}): JSX.Element {
  const settingsForHost = useContext(SlotsContext);

  if (!settingsForHost) {
    throw new Error("Slot requires a host renderer");
  }

  const [entries, setEntries] = createSignal<Entry<Contribution<C>>[]>([]);

  createEffect(() => {
    setEntries(props.registry.entries());
    const unsubscribe = props.registry.watch(setEntries);

    onCleanup(() => {
      void unsubscribe();
    });
  });

  return (
    <For
      each={(() => {
        const settings = settingsForHost();
        const order = settings.order[props.registry.id] ?? [];

        const sorted = entries()
          .filter((e) => !settings.hidden.includes(e.id))
          .sort((a, b) => {
            const ai = order.indexOf(a.id);
            const bi = order.indexOf(b.id);

            return (
              (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi) ||
              a.order - b.order ||
              a.id.localeCompare(b.id)
            );
          });

        return sorted;
      })()}
    >
      {(entry) => (
        <ErrorBoundary
          fallback={
            <div role="alert" class="error">
              This panel failed to render. Reload its plugin to try again.
            </div>
          }
        >
          {createComponent(entry.value.component, props.context)}
        </ErrorBoundary>
      )}
    </For>
  );
}
