import { render } from "solid-js/web";
import type { KernelControlApi } from "@fathom/sdk";
import type { ClientApi } from "@fathom/sdk/ui";
import { RecoveryPanel } from "./RecoveryPanel.tsx";

export function mountRecovery(
  root: HTMLElement,
  client: ClientApi,
  control: KernelControlApi,
) {
  const element = document.createElement("details");
  element.className = "host-controls";
  root.before(element);

  const dispose = render(
    () => <RecoveryPanel client={client} control={control} />,
    element,
  );

  return {
    dispose() {
      dispose();
      element.remove();
    },
  };
}
