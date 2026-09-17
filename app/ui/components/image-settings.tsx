import type { ImageSelection } from "../../sdk/images.ts";
import type { Transport } from "../transport.ts";

import { createResource, createSignal, For, onCleanup, Show } from "solid-js";

import { Button, Field } from "./primitives.tsx";

interface ImageSettingsState {
  selected: ImageSelection | null;
  models: { id: string; name: string; provider: string }[];
}

export function ImageSettings(props: { transport: Transport }) {
  const projectId = props.transport.projectId;
  const [state, { refetch }] = createResource(() =>
    props.transport.request<ImageSettingsState>("images.settings", {
      projectId,
    }),
  );
  const [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal("");
  onCleanup(
    props.transport.onEvent((event) => {
      if (
        event.type === "connected" ||
        (event.projectId === projectId && ["providers", "environment"].includes(event.type))
      )
        void Promise.resolve(refetch()).catch(() => {});
    }),
  );
  async function select(value: string) {
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      const selected = value ? (JSON.parse(value) as ImageSelection) : { model: null };
      await props.transport.request("images.select", {
        ...selected,
        projectId,
      });
      await refetch();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      await Promise.resolve(refetch()).catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <section class="mt-6 space-y-3">
      <h3>Image generation</h3>
      <p class="text-sm text-muted">
        Choose an image model to enable the agent's image tool. Your chat model stays separate.
      </p>
      <Show when={state.error}>
        <p role="alert" class="text-sm text-danger">
          Image models could not load.
        </p>
        <Button onClick={() => void Promise.resolve(refetch()).catch(() => {})}>Retry</Button>
      </Show>
      <Show when={!state.error && state()}>
        {(value) => (
          <Field
            label="Image model"
            hint="Image charges may be missing from catalog-based usage estimates."
          >
            <select
              value={value().selected ? JSON.stringify(value().selected) : ""}
              disabled={busy() || state.loading}
              onChange={(event) => void select(event.currentTarget.value)}
            >
              <option value="">Disabled</option>
              <For each={value().models}>
                {(model) => (
                  <option
                    value={JSON.stringify({
                      provider: model.provider,
                      model: model.id,
                    })}
                  >
                    {model.name} · {model.provider}
                  </option>
                )}
              </For>
            </select>
            <Show when={!value().models.length}>
              <span class="text-sm text-muted">Connect an image provider to choose a model.</span>
            </Show>
          </Field>
        )}
      </Show>
      <Show when={error()}>
        <p role="alert" class="text-sm text-danger">
          {error()}
        </p>
      </Show>
    </section>
  );
}
