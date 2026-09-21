import { definePlugin } from "@fathom/sdk";
import { CredentialsApi } from "@fathom/credentials/contract";
import { Client, SettingsSections } from "@fathom/sdk/ui";
import { ProviderSettings } from "./ProviderSettings.tsx";

export default definePlugin({
  id: "credentials",
  requires: { auth: CredentialsApi, panels: SettingsSections, client: Client },
  start({ panels, auth, client }) {
    panels.add(
      {
        label: "Providers",
        icon: "plugs",
        component: () => <ProviderSettings auth={auth} client={client} />,
      },
      { id: "providers", order: 10 },
    );
  },
});
