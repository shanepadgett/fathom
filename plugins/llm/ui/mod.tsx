import { definePlugin } from "@fathom/sdk";
import { CredentialsApi } from "@fathom/credentials/contract";
import { LlmApi } from "@fathom/llm/contract";
import { Client, SettingsSections } from "@fathom/sdk/ui";
import { ModelWorkbench } from "./ModelWorkbench.tsx";

export default definePlugin({
  id: "llm",
  requires: {
    auth: CredentialsApi,
    llm: LlmApi,
    panels: SettingsSections,
    client: Client,
  },
  start({ panels, auth, llm, client }) {
    panels.add(
      {
        label: "Model diagnostics",
        icon: "robot",
        component: () => (
          <ModelWorkbench auth={auth} llm={llm} client={client} />
        ),
      },
      { id: "diagnostics", order: 90 },
    );
  },
});
