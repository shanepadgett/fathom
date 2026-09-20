import { createComponent, type Component } from "solid-js";
import { render } from "solid-js/web";
import { defineService, type ServiceToken } from "../service.ts";
import type { Dispose } from "../scope.ts";
import { SlotsContext } from "./slot-context.ts";
import type { SlotComposition } from "./slot-contract.ts";

/** Mount into the host root. Dispose the previous mount before replacing it. */
export const Renderer: ServiceToken<{ mount(component: Component): Dispose }> =
  defineService("fathom.renderer");

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
