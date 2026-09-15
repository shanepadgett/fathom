import type { WorkspaceLayout } from "../../sdk/layout.ts";
import type { Transport } from "../transport.ts";

import { createSignal } from "solid-js";

/** Project-backed preferences survive the desktop server's changing origin. */
export function workspaceLayout(
  transport: Transport,
  projectId: () => string | undefined,
  error: (error: unknown) => void,
) {
  const [value, restore] = createSignal<WorkspaceLayout>({
    browserBeside: false,
  });
  let pending = Promise.resolve();
  const update = (patch: Partial<WorkspaceLayout>) => {
    const id = projectId();
    if (!id) return;
    const next = { ...value(), ...patch };
    restore(next);
    pending = pending.then(() =>
      transport.request("settings.layout.set", {
        projectId: id,
        value: next,
      })
    ).then(() => {}, (failure) => {
      if (projectId() === id) error(failure);
    });
  };
  return { value, restore, update, settled: () => pending };
}
