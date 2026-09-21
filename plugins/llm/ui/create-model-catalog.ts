import {
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";
import type { ApiClient } from "@fathom/sdk";
import type { LlmApi, ModelInfo } from "@fathom/llm/contract";

export function createModelCatalog(
  llm: () => ApiClient<typeof LlmApi.operations>,
) {
  const [provider, setProvider] = createSignal("");
  const [model, setModel] = createSignal("");

  let controller: AbortController | undefined;
  onCleanup(() => controller?.abort());

  const [catalog, { refetch, mutate }] = createResource<ModelInfo[], string>(
    // An empty provider is "nothing selected"; only null-ish sources skip the fetch.
    () => provider() || undefined,
    async (id) => {
      controller?.abort();
      controller = new AbortController();

      const list = await llm().models({ provider: id }, controller.signal);

      if (!list.length) {
        throw new Error(
          "This provider returned no visible text models. Try refreshing the list.",
        );
      }

      return list;
    },
    { initialValue: [] },
  );

  // Reading an errored resource throws; the picker wants an empty list instead.
  const models = () => (catalog.error ? [] : catalog());
  const loadingModels = () => catalog.loading;

  const modelError = (): string =>
    catalog.loading ? "" : (catalog.error?.message ?? "");

  createEffect(() => {
    const list = models();
    const previous = untrack(model);

    setModel(
      list.some((m) => m.id === previous) ? previous : (list[0]?.id ?? ""),
    );
  });

  function loadModels(id: string) {
    mutate([]);
    setProvider(id);
  }

  function modelPlaceholder() {
    if (loadingModels()) {
      return "Loading models…";
    }

    if (!provider()) {
      return "Choose a provider first";
    }

    return models().length ? "Choose a model" : "No models loaded";
  }

  function modelSummary() {
    if (loadingModels()) {
      return "Fetching from provider…";
    }

    if (!provider()) {
      return "Select a provider to fetch its current models";
    }

    return `${models().length} models from provider`;
  }

  return {
    provider,
    models,
    model,
    setModel,
    loadingModels,
    modelError,
    loadModels,
    refetch,
    modelPlaceholder,
    modelSummary,
  };
}
