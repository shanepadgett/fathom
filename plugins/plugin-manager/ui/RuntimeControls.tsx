import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import {
  type Change,
  type KernelControlApi,
  type PluginStatus,
} from "@fathom/sdk";
import { Button, Card, Dialog } from "@fathom/sdk/ui";
import { ConfigForm } from "./ConfigForm.tsx";
import { PluginRow } from "./PluginRow.tsx";

const OPERATION_POLL_INTERVAL_MS = 200;

export function RuntimeControls(props: { control: KernelControlApi }) {
  const [plugins, setPlugins] = createSignal<PluginStatus[]>([]);
  const [message, setMessage] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [editing, setEditing] = createSignal<PluginStatus>();
  let live = true;

  onCleanup(() => {
    live = false;
  });

  const refresh = async () => {
    try {
      setPlugins(await props.control.plugins());
    } catch (e) {
      setMessage(String(e));
    }
  };

  onMount(() => void refresh());

  onMount(() => {
    onCleanup(
      props.control.watch((status) => {
        if (live) {
          setPlugins(status);
        }
      }),
    );
  });

  const change = async (
    p: PluginStatus,
    action: Change["action"],
    config?: unknown,
  ) => {
    setBusy(true);
    setMessage(`${action}: ${p.id}…`);

    try {
      const id = await props.control.submit({
        id: p.id,
        host: p.host,
        action,
        ...(action === "config" ? { config } : {}),
      });

      while (live) {
        const op = (await props.control.operations()).find((o) => o.id === id);

        if (op?.state === "failed") {
          throw new Error(op.error);
        }

        if (op?.state === "succeeded") {
          setMessage(`${action}: ${p.id} completed`);
          break;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, OPERATION_POLL_INTERVAL_MS),
        );
      }
    } catch (e) {
      setMessage(String(e));
    } finally {
      if (live) {
        setBusy(false);
        await refresh();
      }
    }
  };

  async function inspectGraph() {
    try {
      setMessage(JSON.stringify(await props.control.graph(), null, 2));
    } catch (error) {
      setMessage(String(error));
    }
  }

  return (
    <div class="grid gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          disabled={busy()}
          onClick={() => void refresh()}
        >
          Refresh status
        </Button>
        <Button variant="secondary" onClick={() => void inspectGraph()}>
          Inspect dependency graph
        </Button>
      </div>
      <Show when={message()}>
        <Card>
          <pre
            class="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-sm text-muted"
            role="status"
          >
            {message()}
          </pre>
        </Card>
      </Show>
      <Card padding="rows">
        <For each={plugins()}>
          {(p) => (
            <PluginRow plugin={p}>
              <Button
                variant="secondary"
                disabled={busy()}
                onClick={() =>
                  void change(p, p.desired.enabled ? "disable" : "enable")
                }
              >
                {p.desired.enabled ? "Disable" : "Enable"}
              </Button>
              <Button
                variant="secondary"
                disabled={busy()}
                onClick={() => void change(p, "reload")}
              >
                Reload
              </Button>
              <Button
                variant="secondary"
                disabled={busy()}
                onClick={() => setEditing(p)}
              >
                Configure
              </Button>
            </PluginRow>
          )}
        </For>
      </Card>
      <Dialog
        open={!!editing()}
        title={`Configure ${editing()?.id ?? "plugin"}`}
        onClose={() => setEditing(undefined)}
      >
        <Show when={editing()}>
          {(plugin) => (
            <ConfigForm
              schema={plugin().configSchema}
              value={plugin().desired.config}
              busy={busy()}
              onSubmit={(config) => {
                // Read the target before closing; the accessor empties with the dialog.
                const target = plugin();
                setEditing(undefined);
                void change(target, "config", config);
              }}
            />
          )}
        </Show>
      </Dialog>
    </div>
  );
}
