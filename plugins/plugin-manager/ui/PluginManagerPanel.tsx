import type { KernelControlApi } from "@fathom/sdk";
import { SettingsSection } from "@fathom/sdk/ui";
import { RuntimeControls } from "./RuntimeControls.tsx";

export function PluginManagerPanel(props: { control: KernelControlApi }) {
  return (
    <SettingsSection
      title="Plugins"
      description="Enable, disable, and reload runtime plugins. Plugin recovery stays available even if you disable this view or the shell."
    >
      <RuntimeControls control={props.control} />
    </SettingsSection>
  );
}
