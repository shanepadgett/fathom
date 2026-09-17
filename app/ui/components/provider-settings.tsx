import type { LoginFlow } from "../../sdk/auth.ts";
import type { Transport } from "../transport.ts";

import { createResource, createSignal, For, onCleanup, Show } from "solid-js";

import { ActionMenu } from "./action-menu.tsx";
import { ConnectionRow } from "./connection-row.tsx";
import { Button, Modal } from "./primitives.tsx";
import { ProviderLogin } from "./provider-login.tsx";

interface Provider {
  id: string;
  name: string;
  connected: boolean;
  source?: string;
  methods: { id: string; name: string }[];
}

export function ProviderSettings(props: { transport: Transport }) {
  const projectId = props.transport.projectId;
  const [providers, { refetch }] = createResource(() =>
    props.transport.request<Provider[]>("providers.list", { projectId }),
  );
  const [flows, { refetch: refreshFlows }] = createResource(() =>
    props.transport.request<LoginFlow[]>("provider.flows", { projectId }),
  );
  const [disconnecting, setDisconnecting] = createSignal<Provider>();
  const [failure, setFailure] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const refreshStatus = async () => {
    if (busy()) return;
    setBusy(true);
    setFailure("");
    try {
      await Promise.all([refetch(), refreshFlows()]);
    } catch {
      setFailure("Could not refresh provider status. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  onCleanup(
    props.transport.onEvent((event) => {
      if (
        event.type === "connected" ||
        (event.projectId === projectId && ["providers", "environment"].includes(event.type))
      ) {
        void Promise.allSettled([refetch(), refreshFlows()]);
      }
    }),
  );
  const act = async (method: string, params: Record<string, unknown>) => {
    if (busy()) return false;
    setBusy(true);
    setFailure("");
    try {
      await props.transport.request(method, { ...params, projectId });
      try {
        await Promise.all([refetch(), refreshFlows()]);
      } catch {
        setFailure(
          "The action succeeded, but connection status could not refresh. Use Refresh to retry.",
        );
      }
      return true;
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Show when={failure()}>
        <p role="alert" class="mb-3 text-danger">
          {failure()}
        </p>
      </Show>
      <div class="flex items-center justify-between gap-3">
        <h3>Providers</h3>
        <Button
          disabled={busy()}
          onClick={() => void refreshStatus()}
          aria-label="Refresh provider status"
        >
          Refresh
        </Button>
      </div>
      <p class="muted">
        Connect an account or use an API key. Authentication is handled on this machine.
      </p>
      <Show when={providers.error}>
        <p class="error">Could not load providers.</p>
      </Show>
      <For each={providers.error ? [] : providers()?.map((provider) => provider.id)}>
        {(providerId) => {
          const provider = () => providers()!.find((item) => item.id === providerId)!;
          return (
            <>
              <ConnectionRow
                name={provider().name}
                avatar={provider().name.slice(0, 1)}
                status={provider().connected ? (provider().source ?? "Connected") : "Not connected"}
              >
                <ActionMenu
                  label={`${provider().name} options`}
                  actions={[
                    ...provider().methods.map((method) => ({
                      label: `${provider().connected ? "Reconnect" : "Connect"} · ${method.name}`,
                      icon: "plus" as const,
                      disabled: busy(),
                      run: () =>
                        void act("provider.login", {
                          providerId: provider().id,
                          type: method.id,
                        }),
                    })),
                    ...(provider().connected
                      ? [
                          {
                            label: "Disconnect",
                            icon: "x" as const,
                            disabled: busy(),
                            run: () => setDisconnecting(provider()),
                          },
                        ]
                      : []),
                  ]}
                />
              </ConnectionRow>
              <For
                each={
                  flows.error
                    ? []
                    : flows()
                        ?.filter(
                          (flow) =>
                            flow.status !== "cancelled" && flow.providerId === provider().id,
                        )
                        .map((flow) => flow.id)
                }
              >
                {(id) => (
                  <ProviderLogin
                    providerName={provider().name}
                    flow={flows()!.find((flow) => flow.id === id)!}
                    busy={busy()}
                    act={act}
                  />
                )}
              </For>
            </>
          );
        }}
      </For>
      <Show when={flows.error}>
        <p role="alert" class="text-danger">
          Could not load sign-in progress. Use Refresh to retry.
        </p>
      </Show>
      <Show when={disconnecting()}>
        {(provider) => (
          <Modal
            title={`Disconnect ${provider().name}?`}
            close={() => {
              if (!busy()) setDisconnecting(undefined);
            }}
          >
            <p>
              This removes the saved credential. When Fathom shares Pi's auth file, Pi will also be
              signed out of this provider.
            </p>
            <Show when={failure()}>
              <p role="alert" class="mt-3 text-danger">
                {failure()}
              </p>
            </Show>
            <div class="mt-4 flex justify-end gap-3">
              <Button disabled={busy()} onClick={() => setDisconnecting(undefined)}>
                Keep connection
              </Button>
              <Button
                variant="danger"
                disabled={busy()}
                onClick={async () => {
                  if (await act("provider.logout", { providerId: provider().id }))
                    setDisconnecting(undefined);
                }}
              >
                Disconnect
              </Button>
            </div>
          </Modal>
        )}
      </Show>
    </>
  );
}
