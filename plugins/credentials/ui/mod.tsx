import { definePlugin } from "@fathom/sdk";
import { CredentialsApi } from "@fathom/credentials/contract";
import { WorkspacePanels } from "@fathom/workspace/contract";
import { Client } from "@fathom/sdk/ui";
import { ConnectionsPanel } from "./ConnectionsPanel.tsx";

export default definePlugin({
  id: "credentials",
  requires: { auth: CredentialsApi, panels: WorkspacePanels, client: Client },
  start({ use }) {
    use.panels.add(
      {
        component: () => (
          <ConnectionsPanel auth={use.auth} client={use.client} />
        ),
      },
      { id: "workbench", order: 0 },
    );
  },
});
