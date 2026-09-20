import { createSignal, onCleanup } from "solid-js";
import type { ApiClient } from "@fathom/sdk";
import type { LlmApi, ModelInfo } from "@fathom/llm/contract";

export function createModelCatalog(
  llm: () => ApiClient<typeof LlmApi.operations>,
) {
  const [provider, setProvider] = createSignal("");
  const [models, setModels] = createSignal<ModelInfo[]>([]);
  const [model, setModel] = createSignal("");
  const [loadingModels, setLoadingModels] = createSignal(false);
  const [modelError, setModelError] = createSignal("");

  let modelController: AbortController | undefined;
  let modelRequest = 0;

  onCleanup(() => {
    modelRequest++;
    modelController?.abort();
  });

  async function loadModels(id: string) {
    const generation = ++modelRequest;
    const previous = id === provider() ? model() : "";

    modelController?.abort();
    modelController = new AbortController();

    setProvider(id);
    setModels([]);
    setModel("");
    setModelError("");
    setLoadingModels(false);

    if (!id) {
      return;
    }

    setLoadingModels(true);

    try {
      const list = await llm().models({ provider: id }, modelController.signal);

      if (generation !== modelRequest) {
        return;
      }

      setModels(list);

      setModel(
        list.some((m) => m.id === previous) ? previous : (list[0]?.id ?? ""),
      );

      if (!list.length) {
        setModelError(
          "This provider returned no visible text models. Try refreshing the list.",
        );
      }
    } catch (e) {
      if (generation === modelRequest) {
        setModelError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (generation === modelRequest) {
        setLoadingModels(false);
      }
    }
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
    modelPlaceholder,
    modelSummary,
  };
}
