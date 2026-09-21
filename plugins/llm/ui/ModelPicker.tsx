import { For, Show } from "solid-js";
import type { Static } from "@fathom/sdk";
import type { ProviderStatusSchema } from "@fathom/credentials/contract";
import { Button, Field, InlineNotice, Select } from "@fathom/sdk/ui";
import type { createModelCatalog } from "./create-model-catalog.ts";

export function ModelPicker(props: {
  providers: Static<typeof ProviderStatusSchema>[];
  running: boolean;
  catalog: ReturnType<typeof createModelCatalog>;
}) {
  return (
    <>
      <div class="grid grid-cols-2 gap-4">
        <Field id="model-provider" label="Provider">
          <Select
            id="model-provider"
            class="w-full"
            value={props.catalog.provider()}
            disabled={props.running}
            onChange={(event) =>
              props.catalog.loadModels(event.currentTarget.value)
            }
          >
            <option value="">Choose a connected provider</option>
            <For
              each={props.providers.filter((provider) => provider.connected)}
            >
              {(provider) => (
                <option value={provider.id}>{provider.label}</option>
              )}
            </For>
          </Select>
        </Field>
        <Field id="model-selection" label="Model">
          <Select
            id="model-selection"
            class="w-full"
            value={props.catalog.model()}
            disabled={
              !props.catalog.provider() ||
              props.catalog.loadingModels() ||
              !props.catalog.models().length ||
              props.running
            }
            onChange={(event) =>
              props.catalog.setModel(event.currentTarget.value)
            }
          >
            <option value="" disabled>
              {props.catalog.modelPlaceholder()}
            </option>
            <For each={props.catalog.models()}>
              {(model) => <option value={model.id}>{model.name}</option>}
            </For>
          </Select>
        </Field>
      </div>
      <div class="flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={
            !props.catalog.provider() ||
            props.catalog.loadingModels() ||
            props.running
          }
          onClick={() => void props.catalog.refetch()}
        >
          Refresh models
        </Button>
        <InlineNotice>{props.catalog.modelSummary()}</InlineNotice>
      </div>
      <Show when={props.catalog.modelError()}>
        <InlineNotice error>{props.catalog.modelError()}</InlineNotice>
      </Show>
    </>
  );
}
