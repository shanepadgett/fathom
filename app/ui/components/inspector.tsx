import type { createWorkspace } from "../state/workspace.ts";
import { Show } from "solid-js";
import { Button, IconButton, Metric } from "./primitives.tsx";
import { PluginSlot } from "./plugin-slot.tsx";
import { InspectorSection } from "./inspector-section.tsx";
import { SessionUsage } from "./session-usage.tsx";

import { LanguageServerSection } from "./language-server-section.tsx";

export function Inspector(props: { app: ReturnType<typeof createWorkspace> }) {
  const {
    state,
    project,
    currentUsage,
    uiHost,
    setTrustDialog,
    transport,
    sessionId,
    refresh,
    act,
  } = props.app;
  return (
    <aside class="flex w-sidebar shrink-0 flex-col border-l border-line bg-surface">
      <header class="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-4 font-medium">
        <span>Session</span>
        <IconButton
          name="x"
          label="Close session panel"
          onClick={() => props.app.setInspector(false)}
        />
      </header>
      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 text-sm">
        <PluginSlot host={uiHost} slot="inspector" />
        <SessionUsage records={currentUsage()} />
        <LanguageServerSection
          transport={transport}
          projectId={project()?.id}
        />
        <InspectorSection title="Runtime">
          <Metric label="Status" value={state()?.session.status ?? "idle"} />
          <Show when={state()?.activity}>
            {(activity) => <Metric label="Activity" value={activity().label} />}
          </Show>
          <Metric label="Provider" value={state()?.session.provider || "—"} />
          <Metric label="Model" value={state()?.session.model || "—"} />
          <Metric label="Thinking" value={state()?.session.thinking ?? "low"} />
          <Metric label="Model calls" value={currentUsage().length} />
          <Metric
            label="Tool executions"
            value={state()?.executions.length ?? 0}
          />
        </InspectorSection>
        <InspectorSection title="Workspace">
          <p class="mono path-label">{project()?.path}</p>
          <Metric
            label="Trust"
            value={project()?.trusted ? "Trusted" : "Restricted"}
          />
          <Button onClick={() => setTrustDialog(true)}>Manage trust</Button>
        </InspectorSection>
        <InspectorSection title="Tool access">
          <select
            aria-label="Tool access"
            value={state()?.session.toolPolicy ?? "default"}
            onChange={(event) =>
              void act(async () => {
                await transport.request("session.update", {
                  sessionId: sessionId(),
                  changes: { toolPolicy: event.currentTarget.value },
                });
                await refresh();
              })}
          >
            <option value="default">All available tools</option>
            <option value="read-only">Read-only</option>
            <option value="no-terminal">No terminal</option>
          </select>
        </InspectorSection>
      </div>
    </aside>
  );
}
