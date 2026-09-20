import "./RuntimeControls.css";
import { createSignal, For, onCleanup, onMount } from "solid-js";
import {
  type Change,
  type KernelControlApi,
  type PluginStatus,
} from "@fathom/sdk";
import { Button } from "@fathom/sdk/ui";

const OPERATION_POLL_INTERVAL_MS = 200;

export function RuntimeControls(props: { control: KernelControlApi }) {
  const [plugins, setPlugins] = createSignal<PluginStatus[]>([]);
  const [message, setMessage] = createSignal("");
  const [busy, setBusy] = createSignal(false);
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

  const change = async (p: PluginStatus, action: Change["action"]) => {
    let config: unknown;

    if (action === "config") {
      const value = prompt(
        `Configuration for ${p.id}`,
        JSON.stringify(p.desired.config, null, 2),
      );

      if (value === null) {
        return;
      }

      try {
        config = JSON.parse(value);
      } catch {
        setMessage("Configuration must be valid JSON");

        return;
      }
    }

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
    <div class="runtime-controls">
      <Button disabled={busy()} onClick={() => void refresh()}>
        Refresh status
      </Button>
      <p role="status">{message()}</p>
      <For each={plugins()}>
        {(p) => (
          <div class="plugin-row">
            <div>
              <strong>{p.id}</strong>
              <span>
                {p.host} · {p.actual.state} · generation {p.actual.gen}
              </span>
              <small>
                {[p.actual.waitingOn?.join(", "), p.actual.lastError]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </div>
            <div>
              <Button
                disabled={busy()}
                onClick={() =>
                  void change(p, p.desired.enabled ? "disable" : "enable")
                }
              >
                {p.desired.enabled ? "Disable" : "Enable"}
              </Button>
              <Button
                disabled={busy()}
                onClick={() => void change(p, "reload")}
              >
                Reload
              </Button>
              <Button
                disabled={busy()}
                onClick={() => void change(p, "config")}
              >
                Configure
              </Button>
            </div>
          </div>
        )}
      </For>
      <Button onClick={() => void inspectGraph()}>
        Inspect dependency graph
      </Button>
    </div>
  );
}
