import type { Transport } from "../transport.ts";

import { createSignal, For, Show } from "solid-js";

import { ImageSettings } from "./image-settings.tsx";
import { McpSettings } from "./mcp-settings.tsx";
import { PluginSettings } from "./plugin-settings.tsx";
import { Button, Field, Modal } from "./primitives.tsx";
import { ProviderSettings } from "./provider-settings.tsx";
import { RuntimeSettings } from "./runtime-settings.tsx";
import { StorageSettings } from "./storage-settings.tsx";

export function Settings(props: {
  transport: Transport;
  close(): void;
  error(error: unknown): void;
  theme: string;
  setTheme(theme: string): void;
}) {
  let panel!: HTMLElement;
  const [tab, setTab] = createSignal("providers");
  return (
    <>
      <Modal title="Settings" close={props.close} wide contentClass="settings-content">
        <div class="settings-layout">
          <nav class="settings-nav" aria-label="Settings sections">
            <For each={["providers", "agent", "connections", "appearance", "plugins", "storage"]}>
              {(name) => (
                <Button
                  class="[&]:justify-start [&]:px-2 aria-[current=page]:bg-surface aria-[current=page]:text-ink"
                  aria-current={tab() === name ? "page" : undefined}
                  onClick={() => {
                    setTab(name);
                    panel.scrollTop = 0;
                  }}
                >
                  {name[0].toUpperCase() + name.slice(1)}
                </Button>
              )}
            </For>
          </nav>
          <section ref={panel} class="settings-panel" aria-label={`${tab()} settings`}>
            <Show when={tab() === "providers"}>
              <ProviderSettings transport={props.transport} />
            </Show>
            <Show when={tab() === "providers"}>
              <ImageSettings transport={props.transport} />
            </Show>
            <Show when={tab() === "agent"}>
              <RuntimeSettings transport={props.transport} error={props.error} />
            </Show>
            <Show when={tab() === "connections"}>
              <McpSettings transport={props.transport} error={props.error} />
            </Show>
            <Show when={tab() === "appearance"}>
              <h3>Appearance</h3>
              <Field label="Color theme">
                <select
                  value={props.theme}
                  onChange={(event) => props.setTheme(event.currentTarget.value)}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </Field>
            </Show>
            <Show when={tab() === "plugins"}>
              <PluginSettings transport={props.transport} />
            </Show>
            <Show when={tab() === "storage"}>
              <StorageSettings transport={props.transport} />
            </Show>
          </section>
        </div>
      </Modal>
    </>
  );
}
