import { createMemo, createSignal, For } from "solid-js";

import { categories, estimate, format, LIMIT } from "./context-data.js";

export function ContextMeter(props) {
  const counts = createMemo(() => estimate(props.session || { messages: [] }, props.liveText));
  const total = createMemo(() => Object.values(counts()).reduce((sum, count) => sum + count, 0));
  const [dismissed, setDismissed] = createSignal(false);
  return (
    <div
      class="context-meter"
      classList={{ "popover-dismissed": dismissed() }}
      tabindex="0"
      aria-describedby="context-breakdown"
      style="--threshold-position:78.125%"
      onKeyDown={(event) => {
        if (event.key === "Escape") setDismissed(true);
      }}
      onMouseEnter={() => setDismissed(false)}
      onFocusIn={() => setDismissed(false)}
    >
      <span class="context-label">Context</span>
      <div
        class="context-track"
        role="progressbar"
        aria-label="Estimated context usage"
        aria-valuemin="0"
        aria-valuemax={LIMIT}
        aria-valuenow={Math.min(LIMIT, total())}
        aria-valuetext={`Approximately ${total()} of ${LIMIT} tokens`}
      >
        <For each={categories}>
          {([key, , color]) => (
            <span
              class="context-segment"
              style={{
                background: color,
                width: `${(counts()[key] / Math.max(LIMIT, total())) * 100}%`,
              }}
            />
          )}
        </For>
        <span class="context-threshold" />
      </div>
      <span class="context-value">~{format(total())} / 256K</span>
      <div class="context-popover" id="context-breakdown" role="tooltip">
        <strong>Context breakdown</strong>
        <For each={categories}>
          {([key, label, color]) => (
            <div class="context-detail">
              <span class="context-dot" style={{ background: color }} />
              <span>{label}</span>
              <span class="context-count">~{format(counts()[key])}</span>
            </div>
          )}
        </For>
        <p>
          Estimated tokens. System and tool definitions use fixed allowances; message text uses
          characters ÷ 4. Reasoning, attachments, and protocol overhead aren’t counted.
        </p>
      </div>
    </div>
  );
}
