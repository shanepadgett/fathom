import { createModelCatalog } from "./create-model-catalog.ts";
import { createResource, createSignal, onCleanup, onMount } from "solid-js";
import type { ApiClient, Static } from "@fathom/sdk";
import type {
  CredentialsApi,
  ProviderStatusSchema,
} from "@fathom/credentials/contract";
import type { LlmApi } from "@fathom/llm/contract";
import type { ClientApi } from "@fathom/sdk/ui";

export function createModelWorkbench(props: {
  auth: ApiClient<typeof CredentialsApi.operations>;
  llm: ApiClient<typeof LlmApi.operations>;
  client: ClientApi;
}) {
  const [providers, { refetch }] = createResource<
    Static<typeof ProviderStatusSchema>[]
  >(() => props.auth.status({}), { initialValue: [] });

  const [error, setError] = createSignal("");

  async function cancel() {
    try {
      await props.llm.cancel({ id: run() });
    } catch (e) {
      setError(String(e));
    }
  }

  const catalog = createModelCatalog(() => props.llm);

  const [prompt, setPrompt] = createSignal(
    "Reply with a short hello and the name of your model.",
  );

  const [run, setRun] = createSignal("");
  const [output, setOutput] = createSignal("");
  const [state, setState] = createSignal("idle");

  async function start() {
    const id = crypto.randomUUID();
    setRun(id);
    setOutput("");
    setState("running");
    setError("");

    try {
      await props.llm.start({
        id,
        provider: catalog.provider(),
        model: catalog.model(),
        prompt: prompt(),
      });
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  onMount(() => {
    onCleanup(props.auth.changed.subscribe(() => void refetch()));

    onCleanup(
      props.llm.progress.subscribe((event) => {
        if (event.id !== run()) {
          return;
        }

        if (event.type === "text") {
          setOutput((text) => text + (event.text ?? ""));
        } else {
          setState(event.type);

          if (event.type === "error") {
            setError(event.text ?? "Model request failed");
          }
        }
      }),
    );

    onCleanup(
      props.client.onReset(() => {
        void refetch();

        if (run()) {
          void props.llm
            .state({ id: run() })
            .then((result) => {
              setOutput(result.text);
              setState(result.state);
            })
            .catch(() => setState("unavailable"));
        }
      }),
    );
  });

  return {
    // Reading an errored resource throws; the view shows the error separately.
    providers: () => (providers.error ? [] : providers()),
    error: (): string => providers.error?.message ?? error(),
    catalog,
    prompt,
    setPrompt,
    output,
    state,
    start,
    cancel,
  };
}
