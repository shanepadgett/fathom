import { SettingsSections } from "@fathom/sdk/ui";
import { definePlugin, KernelControl } from "@fathom/sdk";
import { PluginManagerPanel } from "./PluginManagerPanel.tsx";

export default definePlugin({
  id: "plugin-manager",
  requires: { panels: SettingsSections, control: KernelControl },
  start({ panels, control }) {
    panels.add(
      {
        label: "Plugins",
        icon: "tree-structure",
        component: () => <PluginManagerPanel control={control} />,
      },
      { id: "runtime", order: 100 },
    );
  },
});
