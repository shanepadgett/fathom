import "./ConnectionsPanel.css";
import { For, Show } from "solid-js";
import type { ApiClient } from "@fathom/sdk";
import type { CredentialsApi } from "@fathom/credentials/contract";
import type { ClientApi } from "@fathom/sdk/ui";
import { createConnections } from "./create-connections.ts";
import { ProviderCard } from "./ProviderCard.tsx";

export function ConnectionsPanel(props: {
  auth: ApiClient<typeof CredentialsApi.operations>;
  client: ClientApi;
}) {
  const connections = createConnections(props);

  return (
    <div class="credentials-panel">
      <section aria-labelledby="providers-title">
        <div class="section-heading">
          <h2 id="providers-title">Connections</h2>
          <span>
            {
              connections.providers().filter((provider) => provider.connected)
                .length
            }{" "}
            connected
          </span>
        </div>
        <div class="provider-grid">
          <For each={connections.providers()}>
            {(provider) => (
              <ProviderCard
                provider={provider}
                login={connections.loginFor(provider.id)}
                busy={connections.busy() !== ""}
                onLogin={(method) =>
                  void connections.login(provider.id, method)
                }
                onRemove={() => void connections.remove(provider.id)}
                onReply={(id, value) =>
                  void connections.reply(provider.id, id, value)
                }
                onCancel={(id) => void connections.cancel(provider.id, id)}
              />
            )}
          </For>
        </div>
      </section>
      <Show when={connections.error()}>
        <div class="error" role="alert">
          {connections.error()}
        </div>
      </Show>
    </div>
  );
}
