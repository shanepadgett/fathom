import { ModelPicker } from "./ModelPicker.tsx";
import "./ModelWorkbench.css";
import { Show } from "solid-js";
import type { ApiClient } from "@fathom/sdk";
import type { CredentialsApi } from "@fathom/credentials/contract";
import type { LlmApi } from "@fathom/llm/contract";
import type { ClientApi } from "@fathom/sdk/ui";
import { createModelWorkbench } from "./create-model-workbench.ts";

export function ModelWorkbench(props: {
  auth: ApiClient<typeof CredentialsApi.operations>;
  llm: ApiClient<typeof LlmApi.operations>;
  client: ClientApi;
}) {
  const {
    providers,
    error,
    catalog,
    prompt,
    setPrompt,
    output,
    state,
    start,
    cancel,
  } = createModelWorkbench(props);

  return (
    <div class="llm-panel">
      <Show when={error()}>
        <div class="error" role="alert">
          {error()}
        </div>
      </Show>
      <section class="model-section" aria-labelledby="model-title">
        <div>
          <span class="eyebrow">FIRST REQUEST</span>
          <h2 id="model-title">Try a model.</h2>
          <p>One streaming request through the selected provider.</p>
        </div>
        <div class="model-form">
          <ModelPicker
            providers={providers()}
            running={state() === "running"}
            catalog={catalog}
          />
          <label>
            Prompt
            <textarea
              rows={3}
              value={prompt()}
              disabled={state() === "running"}
              onInput={(e) => setPrompt(e.currentTarget.value)}
            />
          </label>
          <div class="request-actions">
            <button
              type="button"
              class="primary"
              disabled={
                !catalog.provider() ||
                !catalog.model() ||
                !prompt().trim() ||
                state() === "running"
              }
              onClick={() => void start()}
            >
              Send request <span>→</span>
            </button>
            <Show when={state() === "running"}>
              <button type="button" onClick={() => void cancel()}>
                Cancel
              </button>
            </Show>
            <span>{state() === "idle" ? "Ready when you are" : state()}</span>
          </div>
          <Show when={output()}>
            <pre class="model-output" aria-live="polite">
              {output()}
            </pre>
          </Show>
        </div>
      </section>
    </div>
  );
}
