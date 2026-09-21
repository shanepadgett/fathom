import { Show, type JSX } from "solid-js";
import type { PluginStatus } from "@fathom/sdk";

/** One plugin per row: identity and state left, actions right. */
export function PluginRow(props: {
  plugin: PluginStatus;
  children: JSX.Element;
}) {
  const problem = () =>
    [props.plugin.actual.waitingOn?.join(", "), props.plugin.actual.lastError]
      .filter(Boolean)
      .join(" · ");

  return (
    <div class="flex min-h-20 items-center justify-between gap-6 border-b border-line py-4 last:border-b-0">
      <span class="min-w-0">
        <span class="block type-label">{props.plugin.id}</span>
        <span class="mt-1 block type-description">
          {props.plugin.host} · {props.plugin.actual.state} · generation{" "}
          {props.plugin.actual.gen}
        </span>
        <Show when={problem()}>
          <span class="mt-1 block text-dense text-danger">{problem()}</span>
        </Show>
      </span>
      <div class="flex shrink-0 gap-2">{props.children}</div>
    </div>
  );
}
