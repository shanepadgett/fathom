import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { KernelControlApi, PluginStatus } from "@fathom/sdk";
import type { ClientApi } from "@fathom/sdk/ui";
import {
  Button,
  Card,
  InlineNotice,
  StatusDot,
  type Tone,
} from "@fathom/sdk/ui";

const TONES: Record<PluginStatus["actual"]["state"], Tone> = {
  ready: "success",
  starting: "warning",
  stopping: "warning",
  blocked: "warning",
  failed: "danger",
  stopped: "neutral",
};

/** Explain a plugin that is not ready: what it waits on, or what failed. */
function detail(plugin: PluginStatus): string | undefined {
  if (plugin.actual.state === "blocked" && plugin.actual.waitingOn?.length) {
    return `waiting on ${plugin.actual.waitingOn.join(", ")}`;
  }

  if (plugin.actual.lastError) {
    return plugin.actual.lastError;
  }

  if (plugin.actual.restartRequired) {
    return "restart required";
  }

  return undefined;
}

/**
 * Survives removal of every UI plugin. Lists both hosts' plugins with the reason
 * each one is not ready, and offers the change that would recover it.
 */
export function RecoveryPanel(props: {
  control: KernelControlApi;
  client: ClientApi;
}) {
  const [plugins, setPlugins] = createSignal<PluginStatus[]>([]);
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  onMount(() => onCleanup(props.control.watch(setPlugins)));

  const recover = async (plugin: PluginStatus) => {
    setBusy(true);
    setError("");

    try {
      await props.control.submit({
        id: plugin.id,
        host: plugin.host,
        action: plugin.desired.enabled ? "reload" : "enable",
      });
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  };

  const unhealthy = () =>
    plugins().filter((plugin) => plugin.actual.state !== "ready").length;

  return (
    <>
      <summary>
        Plugins · {props.client.connection()}
        <Show when={unhealthy()}> · {unhealthy()} not ready</Show>
      </summary>
      <div class="grid gap-3">
        <Show when={error()}>
          <InlineNotice error>{error()}</InlineNotice>
        </Show>
        <Card padding="rows">
          <For each={plugins()}>
            {(plugin) => (
              <div class="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                <span class="flex min-w-0 items-center gap-2 type-description">
                  <StatusDot
                    tone={TONES[plugin.actual.state]}
                    label={plugin.actual.state}
                  />
                  <span class="truncate">
                    {plugin.id} · {plugin.host}
                    <Show when={detail(plugin)}>
                      {(text) => <span class="text-muted"> · {text()}</span>}
                    </Show>
                  </span>
                </span>
                <Button
                  variant="secondary"
                  disabled={busy()}
                  onClick={() => void recover(plugin)}
                >
                  {plugin.desired.enabled ? "Reload" : "Enable"}
                </Button>
              </div>
            )}
          </For>
        </Card>
      </div>
    </>
  );
}
