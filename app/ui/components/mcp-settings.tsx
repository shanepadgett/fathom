import type { Transport } from "../transport.ts";

import { createResource, createSignal, For, onCleanup, Show } from "solid-js";

import { ConnectionRow } from "./connection-row.tsx";
import { Button, Field } from "./primitives.tsx";

interface Server {
  id: string;
  status: string;
  count: number;
  command?: string;
  url?: string;
}

export function McpSettings(props: { transport: Transport; error(error: unknown): void }) {
  const [servers, { refetch }] = createResource(() =>
    props.transport.request<Server[]>("mcp.list"),
  );
  const [kind, setKind] = createSignal("stdio");
  const [id, setId] = createSignal("");
  const [address, setAddress] = createSignal("");
  const [args, setArgs] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  onCleanup(
    props.transport.onEvent((event) => {
      if (
        event.type === "mcp" &&
        (!event.projectId || event.projectId === props.transport.projectId)
      )
        void refetch();
    }),
  );
  const connect = async () => {
    setBusy(true);
    try {
      await props.transport.request("mcp.connect", {
        id: id().trim(),
        ...(kind() === "stdio"
          ? {
              command: address().trim(),
              args: args().split("\n").filter(Boolean),
            }
          : { url: address().trim() }),
      });
      await refetch();
      setId("");
      setAddress("");
      setArgs("");
    } catch (error) {
      props.error(error);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    try {
      await props.transport.request("mcp.disconnect", { id });
      await refetch();
    } catch (error) {
      props.error(error);
    }
  };
  return (
    <section>
      <h3>MCP connections</h3>
      <p class="muted">
        Connect local tools or a remote MCP endpoint. Tools become searchable by the agent and
        available to scripts.
      </p>
      <Show when={servers.error}>
        <p class="error">Could not load connections.</p>
      </Show>
      <For each={servers()}>
        {(server) => (
          <ConnectionRow
            name={server.id}
            status={
              server.status === "connected"
                ? `${server.count} tools · ${server.url ?? server.command}`
                : server.status
            }
          >
            <Button onClick={() => void remove(server.id)}>Remove</Button>
          </ConnectionRow>
        )}
      </For>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void connect();
        }}
      >
        <h4>Add a connection</h4>
        <Field label="Server ID">
          <input
            required
            pattern="[a-zA-Z][a-zA-Z0-9_]{0,40}"
            value={id()}
            onInput={(event) => setId(event.currentTarget.value)}
            placeholder="workspace_tools"
          />
        </Field>
        <Field label="Connection type">
          <select
            value={kind()}
            onChange={(event) => {
              setKind(event.currentTarget.value);
              setAddress("");
            }}
          >
            <option value="stdio">Local command</option>
            <option value="http">Remote HTTP</option>
          </select>
        </Field>
        <Field label={kind() === "stdio" ? "Executable" : "MCP endpoint URL"}>
          <input
            required
            type={kind() === "stdio" ? "text" : "url"}
            value={address()}
            onInput={(event) => setAddress(event.currentTarget.value)}
            placeholder={kind() === "stdio" ? "/path/to/executable" : "https://example.com/mcp"}
          />
        </Field>
        <Show when={kind() === "stdio"}>
          <Field label="Arguments, one per line">
            <textarea
              value={args()}
              onInput={(event) => setArgs(event.currentTarget.value)}
              rows={4}
            />
          </Field>
        </Show>
        <Button type="submit" variant="primary" disabled={busy()}>
          {busy() ? "Connecting…" : "Connect"}
        </Button>
      </form>
    </section>
  );
}
