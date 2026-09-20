import "./RecoveryPanel.css";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { Kernel } from "@fathom/kernel";
import type { KernelControlApi } from "@fathom/sdk";
import type { ClientApi } from "@fathom/sdk/ui";

export function RecoveryPanel(props: {
  kernel: Kernel;
  control: KernelControlApi;
  client: ClientApi;
}) {
  const [plugins, setPlugins] = createSignal<ReturnType<Kernel["plugins"]>>([]);
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  onMount(() => onCleanup(props.kernel.watch(setPlugins)));

  return (
    <>
      <summary>Plugin recovery · {props.client.connection()}</summary>
      <Show when={error()}>
        <p role="alert">{error()}</p>
      </Show>
      <For
        each={plugins().filter(
          (p) => !p.desired.enabled || p.actual.state === "failed",
        )}
      >
        {(plugin) => (
          <div>
            <p>
              {plugin.id}: {plugin.actual.lastError ?? "disabled"}
            </p>
            <button
              type="button"
              class="fathom-control"
              disabled={busy()}
              onClick={async () => {
                setBusy(true);
                setError("");

                try {
                  const id = await props.control.submit({
                    id: plugin.id,
                    host: "ui",
                    action: plugin.desired.enabled ? "reload" : "enable",
                  });

                  await props.kernel.settled();

                  const operation = props.kernel
                    .operations()
                    .find((op) => op.id === id);

                  if (operation?.state === "failed") {
                    throw new Error(operation.error);
                  }
                } catch (error) {
                  setError(String(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {plugin.desired.enabled ? "Retry" : "Enable"} {plugin.id}
            </button>
          </div>
        )}
      </For>
    </>
  );
}
