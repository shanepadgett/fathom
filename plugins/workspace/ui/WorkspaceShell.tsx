import { createSignal, Show } from "solid-js";
import type { Registry } from "@fathom/sdk";
import {
  createSlotEntries,
  Slot,
  type ApplicationContext,
  type ClientApi,
  type Contribution,
  type NamedContribution,
  type SlotComposition,
} from "@fathom/sdk/ui";
import { EmptyState, ResizableSidebar, Tabs } from "@fathom/sdk/ui";
import { WorkspaceHeader } from "./WorkspaceHeader.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { createWorkspaceNavigation } from "./create-workspace-navigation.ts";

type Region = Registry<Contribution<ApplicationContext>>;

export function WorkspaceShell(props: {
  client: ClientApi;
  pages: Registry<NamedContribution>;
  settings: Registry<NamedContribution>;
  header: Region;
  left: Region;
  right: Region;
  status: Region;
  slots: () => SlotComposition;
}) {
  const navigation = createWorkspaceNavigation();
  const pages = createSlotEntries(() => props.pages);
  const left = createSlotEntries(() => props.left);
  const right = createSlotEntries(() => props.right);
  const [sidebarOpen, setSidebarOpen] = createSignal(true);

  const hasLeft = () =>
    left().some(
      (entry) => entry.id === props.slots().selected?.[props.left.id],
    );

  const hasRight = () =>
    right().some(
      (entry) => entry.id === props.slots().selected?.[props.right.id],
    );

  return (
    <div class="relative flex h-dvh min-w-workspace-minimum flex-col bg-canvas text-ink">
      <Show
        when={navigation.route().area === "settings"}
        fallback={
          <>
            <WorkspaceHeader
              sidebarAvailable={hasLeft()}
              sidebarOpen={sidebarOpen()}
              onToggleSidebar={() => setSidebarOpen((open) => !open)}
              onSettings={() => navigation.settings()}
            >
              <Slot registry={props.header} context={{}} />
            </WorkspaceHeader>
            <div class="relative z-0 flex min-h-0 flex-1">
              <Show when={hasLeft() && sidebarOpen()}>
                <ResizableSidebar label="Workspace sidebar">
                  <Slot registry={props.left} context={{}} mode="single" />
                </ResizableSidebar>
              </Show>
              <main class="flex min-w-0 flex-1 flex-col overflow-auto">
                <Show when={pages().length}>
                  <Tabs
                    label="Workspace pages"
                    items={pages().map((entry) => ({
                      id: entry.id,
                      label: entry.value.label,
                    }))}
                    selected={navigation.route().id ?? ""}
                    onSelect={(id) => navigation.page(id)}
                  />
                </Show>
                <Slot
                  registry={props.pages}
                  context={{}}
                  mode="keyed"
                  selected={navigation.route().id}
                  fallback={
                    <EmptyState>
                      Open Settings to connect providers. Workspace pages appear
                      when their plugins are enabled.
                    </EmptyState>
                  }
                />
              </main>
              <Show when={hasRight()}>
                <ResizableSidebar label="Inspector" side="right">
                  <Slot registry={props.right} context={{}} mode="single" />
                </ResizableSidebar>
              </Show>
            </div>
            <footer class="flex min-h-12 shrink-0 items-center justify-between gap-6 border-t border-line bg-surface px-4 text-sm">
              <div class="flex items-center gap-4">
                <Slot registry={props.status} context={{}} />
              </div>
              <span class="type-description" role="status">
                {props.client.connection()}
              </span>
            </footer>
          </>
        }
      >
        <SettingsPage
          sections={props.settings}
          selected={navigation.route().id ?? "workspace/general"}
          onSelect={(id) => navigation.settings(id)}
          onClose={() => navigation.workspace()}
        />
      </Show>
    </div>
  );
}
