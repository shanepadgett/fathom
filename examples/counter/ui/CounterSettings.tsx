import { createSignal, onCleanup, onMount } from "solid-js";
import type { ApiClient } from "@fathom/sdk";
import { Button, Card, SettingRow, SettingsSection } from "@fathom/sdk/ui";
import type { CounterApi } from "../contract.ts";

export function CounterSettings(props: {
  api: ApiClient<typeof CounterApi.operations>;
}) {
  const [count, setCount] = createSignal(0);

  onMount(() => {
    void props.api.read({}).then((state) => setCount(state.count));
    onCleanup(props.api.changed.subscribe((state) => setCount(state.count)));
  });

  return (
    <SettingsSection
      title="Counter"
      description="A backend value, a typed API, and a settings page."
    >
      <Card padding="rows">
        <SettingRow
          label="Count"
          description="Stored by the backend between runs."
        >
          <span class="flex items-center gap-3">
            <span class="type-label">{count()}</span>
            <Button
              variant="secondary"
              onClick={() => void props.api.increment({})}
            >
              Increment
            </Button>
          </span>
        </SettingRow>
      </Card>
    </SettingsSection>
  );
}
