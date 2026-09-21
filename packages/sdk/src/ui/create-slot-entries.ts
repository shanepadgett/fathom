import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
  type Accessor,
} from "solid-js";
import type { Entry, Registry } from "../registry.ts";
import { SlotsContext } from "./slot-context.ts";

/** The same visible, ordered entries used by outlets and their navigation. */
export function createSlotEntries<E>(
  registry: Accessor<Registry<E>>,
): Accessor<Entry<E>[]> {
  const settings = useContext(SlotsContext);

  if (!settings) {
    throw new Error("Slots require a host renderer");
  }

  const [entries, setEntries] = createSignal<Entry<E>[]>([]);

  createEffect(() => {
    const stop = registry().watch(setEntries);

    onCleanup(() => {
      void stop();
    });
  });

  return createMemo(() => {
    const composition = settings();
    const order = composition.order[registry().id] ?? [];

    return entries()
      .filter((entry) => !composition.hidden.includes(entry.id))
      .sort((a, b) => {
        const ai = order.indexOf(a.id);
        const bi = order.indexOf(b.id);

        return (
          (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi) ||
          a.order - b.order ||
          a.id.localeCompare(b.id)
        );
      });
  });
}
