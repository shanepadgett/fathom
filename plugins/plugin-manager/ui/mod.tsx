import { WorkspacePanels } from "@fathom/workspace/contract";
import { definePlugin, KernelControl } from "@fathom/sdk";
import { PluginManagerPanel } from "./PluginManagerPanel.tsx";

export default definePlugin({
  id: "plugin-manager",
  requires: { panels: WorkspacePanels, control: KernelControl },
  start({ use }) {
    use.panels.add(
      {
        component: () => <PluginManagerPanel control={use.control} />,
      },
      { id: "panel", order: 10 },
    );
  },
});
