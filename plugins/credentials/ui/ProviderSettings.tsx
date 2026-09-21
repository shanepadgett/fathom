import { createSignal, For, Show } from "solid-js";
import type { ApiClient } from "@fathom/sdk";
import type { CredentialsApi } from "@fathom/credentials/contract";
import type { ClientApi } from "@fathom/sdk/ui";
import { EmptyState, InlineNotice, NavItem, StatusDot } from "@fathom/sdk/ui";
import { createConnections } from "./create-connections.ts";
import { ProviderConnection } from "./ProviderConnection.tsx";

export function ProviderSettings(props: {
  auth: ApiClient<typeof CredentialsApi.operations>;
  client: ClientApi;
}) {
  const connections = createConnections(props);
  const [selected, setSelected] = createSignal("");

  const provider = () =>
    selected()
      ? connections.providers().find((item) => item.id === selected())
      : connections.providers()[0];

  return (
    <div class="flex min-h-full">
      <nav
        aria-label="Providers"
        class="w-48 shrink-0 overflow-auto border-r border-line"
      >
        <For each={connections.providers()}>
          {(item) => (
            <NavItem
              label={item.label}
              aria-current={provider()?.id === item.id ? "page" : undefined}
              onClick={() => setSelected(item.id)}
              trailing={
                <StatusDot
                  tone={item.connected ? "success" : "neutral"}
                  small
                  label={item.connected ? "Connected" : "Not connected"}
                />
              }
            />
          )}
        </For>
      </nav>
      <div class="min-w-0 flex-1">
        <Show when={connections.error()}>
          <div class="px-10 pt-8">
            <InlineNotice error>{connections.error()}</InlineNotice>
          </div>
        </Show>
        <Show
          when={provider()}
          keyed
          fallback={
            <EmptyState>
              Enable a provider plugin to set up a connection.
            </EmptyState>
          }
        >
          {(item) => (
            <ProviderConnection
              provider={item}
              login={connections.loginFor(item.id)}
              busy={connections.busy() !== ""}
              onLogin={(method) => void connections.login(item.id, method)}
              onConnect={(method, value) =>
                void connections.connect(item.id, method, value)
              }
              onRemove={() => void connections.remove(item.id)}
              onReply={(id, value) =>
                void connections.reply(item.id, id, value)
              }
              onCancel={(id) => void connections.cancel(item.id, id)}
              onOpen={(id) => void connections.open(item.id, id)}
            />
          )}
        </Show>
      </div>
    </div>
  );
}
