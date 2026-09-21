import { Show } from "solid-js";
import type { AppearanceApi } from "@fathom/sdk/ui";
import {
  Card,
  InlineNotice,
  Select,
  SettingRow,
  SettingsSection,
  Switch,
} from "@fathom/sdk/ui";

export function GeneralSettings(props: { appearance: AppearanceApi }) {
  return (
    <SettingsSection>
      <section aria-labelledby="appearance-title">
        <h2 id="appearance-title" class="type-section-title mb-3">
          Appearance
        </h2>
        <Card padding="rows">
          <SettingRow
            label="Theme"
            description="Choose how your workspace looks."
          >
            <Select
              class="w-44 shrink-0"
              value={props.appearance.theme()}
              onChange={(event) => {
                const value = event.currentTarget.value;

                if (
                  value === "system" ||
                  value === "light" ||
                  value === "dark"
                ) {
                  props.appearance.setTheme(value);
                }
              }}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </SettingRow>
          <SettingRow
            label="Reduce motion"
            description="Keep transitions and animations to a minimum."
          >
            <Switch
              label="Reduce motion"
              checked={props.appearance.motion() === "reduce"}
              onChange={(event) =>
                props.appearance.setMotion(
                  event.currentTarget.checked ? "reduce" : "system",
                )
              }
            />
          </SettingRow>
        </Card>
      </section>
      <Show when={props.appearance.error()}>
        <div class="mt-4">
          <InlineNotice error>{props.appearance.error()}</InlineNotice>
        </div>
      </Show>
    </SettingsSection>
  );
}
