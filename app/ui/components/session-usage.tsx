import type { UsageRecord } from "../../sdk/session.ts";

import { createMemo } from "solid-js";

import { InspectorSection } from "./inspector-section.tsx";
import { MetricList } from "./metric-list.tsx";

export function SessionUsage(props: { records: UsageRecord[] }) {
  const totals = createMemo(() =>
    props.records.reduce(
      (sum, record) => ({
        cost: sum.cost + record.usage.cost.total,
        input: sum.input + record.usage.input,
        output: sum.output + record.usage.output,
        cacheRead: sum.cacheRead + record.usage.cacheRead,
        cacheWrite: sum.cacheWrite + record.usage.cacheWrite,
        duration: sum.duration + record.durationMs,
      }),
      {
        cost: 0,
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        duration: 0,
      },
    ),
  );
  const cacheHit = () => {
    const value = totals();
    const input = value.input + value.cacheRead + value.cacheWrite;
    return input ? `${Math.round((value.cacheRead / input) * 100)}%` : "—";
  };
  return (
    <>
      <InspectorSection title="Usage">
        <MetricList
          metrics={[
            ["Session cost", `$${totals().cost.toFixed(4)}`],
            ["Model time", `${(totals().duration / 1000).toFixed(1)}s`],
            [
              "Output",
              totals().duration
                ? `${Math.round(totals().output / (totals().duration / 1000))} tok/s`
                : "—",
            ],
            ["Cache hit", cacheHit()],
          ]}
        />
      </InspectorSection>
      <InspectorSection title="Tokens">
        <MetricList
          metrics={[
            ["Input", totals().input.toLocaleString()],
            ["Output", totals().output.toLocaleString()],
            ["Cache read", totals().cacheRead.toLocaleString()],
            ["Cache write", totals().cacheWrite.toLocaleString()],
          ]}
        />
      </InspectorSection>
    </>
  );
}
