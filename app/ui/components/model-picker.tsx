import type { ModelChoice } from "../../sdk/models.ts";

import { createEffect, createSignal, For, on, Show } from "solid-js";

import { Field } from "./primitives.tsx";
import { SearchDialog } from "./search-dialog.tsx";
import { SearchList } from "./search-list.tsx";
import { SelectorButton } from "./selector-button.tsx";

export function ModelPicker(props: {
  models: ModelChoice[];
  provider: string;
  model: string;
  contextKey?: string;
  thinking?: string;
  thinkingLevels?: string[];
  selectThinking?(value: string): void | Promise<void>;
  select(value: string): void | Promise<void>;
}) {
  const [open, setOpen] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [failure, setFailure] = createSignal("");
  createEffect(
    on(
      () => props.contextKey,
      () => {
        setOpen(false);
        setFailure("");
      },
    ),
  );
  async function thinking(value: string) {
    if (saving()) return;
    const context = props.contextKey;
    setSaving(true);
    setFailure("");
    try {
      await props.selectThinking?.(value);
    } catch (error) {
      if (context === props.contextKey) {
        setFailure(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setSaving(false);
    }
  }
  const selected = () =>
    props.models.find((model) => model.id === props.model && model.provider === props.provider);
  return (
    <>
      <SelectorButton
        value={selected()?.name ?? "Choose model"}
        secondary={props.thinkingLevels?.length ? props.thinking : undefined}
        onClick={() => setOpen(true)}
        label="Choose model and thinking effort"
        disabled={saving()}
      />
      <Show when={open()}>
        <SearchDialog label="Choose a model" close={() => setOpen(false)}>
          <SearchList
            items={props.models}
            disabled={saving()}
            label="Search models"
            placeholder="Search by model or provider…"
            empty={
              props.models.length
                ? "No matching models. Try a different search."
                : "No models available. Connect a provider in Settings."
            }
            searchText={(model) => `${model.name} ${model.id} ${model.provider}`}
            select={async (model) => {
              if (saving()) return;
              setSaving(true);
              try {
                await props.select(`${model.provider}/${model.id}`);
                setOpen(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            {(model) => (
              <span class="flex w-full items-center justify-between gap-3">
                <span class="flex min-w-0 flex-col gap-1">
                  <span class="font-medium">{model.name}</span>
                  <span class="text-xs text-muted">
                    {model.provider}
                    {model.id === props.model && model.provider === props.provider
                      ? " · Current"
                      : ""}
                  </span>
                </span>
                <span class="shrink-0 text-muted">{Math.round(model.contextWindow / 1000)}k</span>
              </span>
            )}
          </SearchList>
          <Show when={(props.thinkingLevels?.length ?? 0) > 1 && props.selectThinking}>
            <div class="border-t border-line p-4">
              <Field label="Thinking effort">
                <select
                  value={props.thinking}
                  disabled={saving()}
                  onChange={(event) => {
                    const select = event.currentTarget;
                    void thinking(select.value).finally(() => {
                      if (select.isConnected) {
                        select.value = props.thinking ?? "";
                      }
                    });
                  }}
                >
                  <For each={props.thinkingLevels}>
                    {(level) => <option value={level}>{level}</option>}
                  </For>
                </select>
              </Field>
              <Show when={failure()}>
                <p role="alert" class="mt-2 text-sm text-danger">
                  {failure()}
                </p>
              </Show>
            </div>
          </Show>
        </SearchDialog>
      </Show>
    </>
  );
}
