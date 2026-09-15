import type { UsageRecord } from "../../sdk/session.ts";
import type { createWorkspace } from "../state/workspace.ts";

import { createSignal, Show } from "solid-js";

import { PluginSlot } from "./plugin-slot.tsx";
import { occludeNativeSurfaces } from "../state/native-surfaces.ts";

export function WorkspaceStatus(
  props: { app: ReturnType<typeof createWorkspace> },
) {
  const app = props.app;
  const [usageOpen, setUsageOpen] = createSignal(false);
  const running = () =>
    app.sessions().filter((session) =>
      ["running", "retry_waiting", "approval"].includes(session.status)
    ).length;
  const maximum = () =>
    app.models().find((model) =>
      model.provider === app.state()?.session.provider &&
      model.id === app.state()?.session.model
    )?.contextWindow ?? 0;
  const latest = () =>
    app.currentUsage().filter((record) =>
      record.provider === app.state()?.session.provider &&
      record.model === app.state()?.session.model
    ).reduce<UsageRecord | undefined>(
      (last, record) =>
        !last || record.createdAt > last.createdAt ? record : last,
      undefined,
    );
  const usage = () => latest()?.usage;
  const input = () =>
    (usage()?.input ?? 0) + (usage()?.cacheRead ?? 0) +
    (usage()?.cacheWrite ?? 0);
  const value = () => input() + (usage()?.output ?? 0);
  const format = (tokens: number) => `${(tokens / 1000).toFixed(1)}k`;
  occludeNativeSurfaces(() => usageOpen() && maximum() > 0);
  return (
    <footer
      data-component="workspace-status"
      class="flex min-h-12 shrink-0 items-center justify-between gap-6 border-t border-line bg-surface px-4 text-sm"
    >
      <span class="flex items-center gap-2" role="status">
        <span
          class={`h-2 w-2 shrink-0 rounded-full ${
            !app.connected()
              ? "bg-warning"
              : running()
              ? "bg-success"
              : "bg-muted"
          }`}
          aria-hidden="true"
        />
        {!app.connected()
          ? "Reconnecting…"
          : running()
          ? `${running()} ${running() === 1 ? "agent" : "agents"} running`
          : "All quiet"}
      </span>
      <PluginSlot host={app.uiHost} slot="status" />
      <Show when={!app.project()?.trusted}>
        <button class="text-warning" onClick={() => app.setTrustDialog(true)}>
          Restricted mode
        </button>
      </Show>
      <Show
        when={maximum() > 0}
        fallback={<span class="text-muted">Context unavailable</span>}
      >
        <details
          class="context-usage relative ml-auto"
          onToggle={(event) => setUsageOpen(event.currentTarget.open)}
        >
          <summary
            class="flex items-center gap-3 py-2"
            aria-label="Show context usage"
          >
            <span
              class="relative h-3 w-32 rounded-sm bg-line"
              role="meter"
              aria-label="Last reported context tokens"
              aria-valuemin={0}
              aria-valuemax={maximum()}
              aria-valuenow={Math.min(value(), maximum())}
              aria-valuetext={`${value()} of ${maximum()} tokens`}
            >
              <span
                class="block h-full rounded-sm bg-action"
                style={{
                  width: `${Math.min(100, value() / maximum() * 100)}%`,
                }}
              />
              <span
                class="context-compaction-marker absolute -top-1 -bottom-1 border-l border-ink"
                aria-hidden="true"
              />
            </span>
            <span class="whitespace-nowrap">
              {format(value())} / {format(maximum())}
            </span>
          </summary>
          <div
            class="context-usage-popover absolute bottom-full right-0 z-20 w-72 rounded-lg border border-line bg-surface p-4 text-dense text-ink shadow-menu"
            role="region"
            aria-label="Context breakdown"
          >
            <div class="mb-4 flex items-center justify-between gap-4">
              <strong class="font-medium">Context breakdown</strong>
              <span class="text-muted">
                {Math.round(value() / maximum() * 100)}% used
              </span>
            </div>
            <p class="mb-3 text-sm text-muted">
              {latest()
                ? "Last reported model call; pending messages are not included."
                : "No model usage reported yet."}
            </p>
            <dl class="flex flex-col gap-3">
              <div class="flex justify-between gap-2">
                <dt>Input and cache</dt>
                <dd>{format(input())}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt>Output</dt>
                <dd>{format(usage()?.output ?? 0)}</dd>
              </div>
            </dl>
            <div class="mt-4 flex justify-between border-t border-line pt-3">
              <span class="text-muted">Available</span>
              <span>{format(Math.max(0, maximum() - value()))}</span>
            </div>
          </div>
        </details>
      </Show>
    </footer>
  );
}
