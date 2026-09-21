import { createResource, onCleanup, onMount, Show } from "solid-js";
import type { ApiClient } from "@fathom/sdk";
import {
  Button,
  Card,
  InlineNotice,
  SettingRow,
  SettingsSection,
} from "@fathom/sdk/ui";
import type { CounterApi } from "../contract.ts";

export function CounterSettings(props: {
  api: ApiClient<typeof CounterApi.operations>;
}) {
  const [state, { mutate }] = createResource(() => props.api.read({}));

  onMount(() => {
    onCleanup(props.api.changed.subscribe((next) => mutate(next)));
  });

  return (
    <SettingsSection
      title="Counter"
      description="A backend value, a typed API, and a settings page."
    >
      <Show
        when={!state.error}
        fallback={<InlineNotice error>{state.error.message}</InlineNotice>}
      >
        <Card padding="rows">
          <SettingRow
            label="Count"
            description="Stored by the backend between runs."
          >
            <span class="flex items-center gap-3">
              <span class="type-label">{state()?.count ?? 0}</span>
              <Button
                variant="secondary"
                onClick={() => void props.api.increment({})}
              >
                Increment
              </Button>
            </span>
          </SettingRow>
        </Card>
      </Show>
    </SettingsSection>
  );
}
