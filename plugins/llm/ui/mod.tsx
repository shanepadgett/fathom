import { definePlugin } from "@fathom/sdk";
import { CredentialsApi } from "@fathom/credentials/contract";
import { LlmApi } from "@fathom/llm/contract";
import { WorkspacePanels } from "@fathom/workspace/contract";
import { Client } from "@fathom/sdk/ui";
import { ModelWorkbench } from "./ModelWorkbench.tsx";

export default definePlugin({
  id: "llm",
  requires: {
    auth: CredentialsApi,
    llm: LlmApi,
    panels: WorkspacePanels,
    client: Client,
  },
  start({ use }) {
    use.panels.add(
      {
        component: () => (
          <ModelWorkbench auth={use.auth} llm={use.llm} client={use.client} />
        ),
      },
      { id: "workbench", order: 5 },
    );
  },
});
