import { For } from "solid-js";

export function MetricList(
  props: { metrics: readonly (readonly [string, string | number])[] },
) {
  return (
    <dl class="flex flex-col gap-3">
      <For each={props.metrics}>
        {([label, value]) => (
          <div class="flex justify-between gap-3">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        )}
      </For>
    </dl>
  );
}
