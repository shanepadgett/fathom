import { Show } from "solid-js";
import type { ApiClient } from "@fathom/sdk";
import type { CredentialsApi } from "@fathom/credentials/contract";
import type { LlmApi } from "@fathom/llm/contract";
import type { ClientApi } from "@fathom/sdk/ui";
import {
  Button,
  Card,
  Field,
  InlineNotice,
  Textarea,
  SettingsSection,
} from "@fathom/sdk/ui";
import { ModelPicker } from "./ModelPicker.tsx";
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
    <SettingsSection
      title="Model diagnostics"
      description="One streaming request to check a provider connection. This is not a conversation."
    >
      <div class="grid gap-6">
        <Show when={error()}>
          <InlineNotice error>{error()}</InlineNotice>
        </Show>
        <ModelPicker
          providers={providers()}
          running={state() === "running"}
          catalog={catalog}
        />
        <Field id="model-prompt" label="Prompt">
          <Textarea
            id="model-prompt"
            class="w-full"
            rows={4}
            value={prompt()}
            disabled={state() === "running"}
            onInput={(event) => setPrompt(event.currentTarget.value)}
          />
        </Field>
        <div class="flex items-center gap-3">
          <Button
            variant="primary"
            disabled={
              !catalog.provider() ||
              !catalog.model() ||
              !prompt().trim() ||
              state() === "running"
            }
            onClick={() => void start()}
          >
            Send request
          </Button>
          <Show when={state() === "running"}>
            <Button variant="secondary" onClick={() => void cancel()}>
              Cancel
            </Button>
          </Show>
          <span class="type-description" role="status">
            {state()}
          </span>
        </div>
        <Show when={output()}>
          <Card>
            <pre
              class="max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-sm"
              aria-live="polite"
            >
              {output()}
            </pre>
          </Card>
        </Show>
      </div>
    </SettingsSection>
  );
}
