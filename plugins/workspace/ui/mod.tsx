import { WorkspacePanels } from "@fathom/workspace/contract";
import { definePlugin } from "@fathom/sdk";
import { Client, Renderer } from "@fathom/sdk/ui";
import { WorkspaceShell } from "./WorkspaceShell.tsx";

export default definePlugin({
  id: "workspace",
  requires: { renderer: Renderer, client: Client },
  provides: { panels: WorkspacePanels },
  start({ use, scope }) {
    scope.defer(
      use.renderer.mount(() => (
        <WorkspaceShell client={use.client} panels={use.panels} />
      )),
    );
  },
});
