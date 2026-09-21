import { createComponent, type Component } from "solid-js";
import { render } from "solid-js/web";
import type { Dispose } from "@fathom/sdk";
import { SlotsContext, type SlotComposition } from "@fathom/sdk/ui";

/** Host-only root mounting. Plugins contribute to AppShell instead. */
export function createRenderer(
  root: HTMLElement,
  slots: () => SlotComposition,
): { mount(component: Component): Dispose } {
  return {
    mount(component: Component) {
      root.replaceChildren();

      return render(
        () => (
          <SlotsContext.Provider value={slots}>
            {createComponent(component, {})}
          </SlotsContext.Provider>
        ),
        root,
      );
    },
  };
}
