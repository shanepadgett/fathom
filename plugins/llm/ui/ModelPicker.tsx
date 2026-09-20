import { For, Show } from "solid-js";
import type { Static } from "@fathom/sdk";
import type { ProviderStatusSchema } from "@fathom/credentials/contract";
import type { createModelCatalog } from "./create-model-catalog.ts";

export function ModelPicker(props: {
  providers: Static<typeof ProviderStatusSchema>[];
  running: boolean;
  catalog: ReturnType<typeof createModelCatalog>;
}) {
  return (
    <>
      <div class="field-row">
        <label>
          Provider
          <select
            value={props.catalog.provider()}
            disabled={props.running}
            onChange={(e) =>
              void props.catalog.loadModels(e.currentTarget.value)
            }
          >
            <option value="">Choose a connected provider</option>
            <For each={props.providers.filter((p) => p.connected)}>
              {(p) => <option value={p.id}>{p.label}</option>}
            </For>
          </select>
        </label>
        <label>
          Model
          <select
            value={props.catalog.model()}
            disabled={
              !props.catalog.provider() ||
              props.catalog.loadingModels() ||
              !props.catalog.models().length ||
              props.running
            }
            onChange={(e) => props.catalog.setModel(e.currentTarget.value)}
          >
            <option value="" disabled>
              {props.catalog.modelPlaceholder()}
            </option>
            <For each={props.catalog.models()}>
              {(m) => <option value={m.id}>{m.name}</option>}
            </For>
          </select>
        </label>
      </div>
      <div class="request-actions" aria-live="polite">
        <button
          type="button"
          disabled={
            !props.catalog.provider() ||
            props.catalog.loadingModels() ||
            props.running
          }
          onClick={() =>
            void props.catalog.loadModels(props.catalog.provider())
          }
        >
          Refresh models
        </button>
        <span>{props.catalog.modelSummary()}</span>
      </div>
      <Show when={props.catalog.modelError()}>
        <div class="error" role="alert">
          {props.catalog.modelError()}
        </div>
      </Show>
    </>
  );
}
