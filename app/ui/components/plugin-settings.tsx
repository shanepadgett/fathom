import type { Transport } from "../transport.ts";

import { createResource, createSignal, For, onCleanup, Show } from "solid-js";

import { Button } from "./primitives.tsx";

interface PluginStatus {
  id: string;
  status: string;
  provides: string[];
}

export function PluginSettings(props: { transport: Transport }) {
  const projectId = props.transport.projectId;
  const [plugins, { refetch }] = createResource(() =>
    props.transport.request<PluginStatus[]>("plugins.list", { projectId })
  );
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");

  async function refresh() {
    try {
      await refetch();
    } catch {
      // The resource owns the visible loading error.
    }
  }

  onCleanup(props.transport.onEvent((event) => {
    if (
      event.type === "connected" ||
      (event.type === "environment" && event.projectId === projectId)
    ) void refresh();
  }));

  async function reload() {
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      await props.transport.request("plugins.reload", { projectId });
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3>Environment</h3>
        <Button disabled={busy()} onClick={() => void reload()}>
          {busy() ? "Reloading…" : "Reload environment"}
        </Button>
      </div>
      <p class="muted">
        Add personal plugins globally or project plugins in .fathom/plugins.
        Reload to apply changes.
      </p>
      <Show when={plugins.error}>
        <div role="alert" class="my-3 text-danger">
          <p>Could not load plugins.</p>
          <Button
            disabled={plugins.loading || busy()}
            onClick={() => void refresh()}
          >
            Retry
          </Button>
        </div>
      </Show>
      <Show when={plugins.loading}>
        <p role="status" class="my-3 text-sm text-muted">Loading plugins…</p>
      </Show>
      <div aria-busy={plugins.loading || busy()}>
        <For each={plugins.error ? [] : plugins()}>
          {(plugin) => (
            <div class="plugin-row">
              <strong>{plugin.id}</strong>
              <span class="muted">
                {plugin.provides.join(", ") || "Contribution"}
              </span>
              <small>{plugin.status}</small>
            </div>
          )}
        </For>
      </div>
      <Show when={error()}>
        <p role="alert" class="my-3 text-danger">{error()}</p>
      </Show>
    </>
  );
}
