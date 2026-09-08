import { html, render } from "lit";

import { categories, estimate, format, LIMIT } from "./context-data.js";

export function createContextMeter() {
  const node = document.createElement("div");
  node.className = "context-meter";
  node.tabIndex = 0;
  node.setAttribute("aria-describedby", "context-breakdown");
  node.style.setProperty("--threshold-position", "78.125%");
  node.addEventListener("keydown", (event) => {
    if (event.key === "Escape") node.classList.add("popover-dismissed");
  });
  for (const event of ["mouseenter", "focusin"]) {
    node.addEventListener(event, () => node.classList.remove("popover-dismissed"));
  }
  return {
    node,
    update(session, liveText = "") {
      const counts = estimate(session, liveText);
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      render(
        html`
          <span class="context-label">Context</span>
          <div
            class="context-track"
            role="progressbar"
            aria-label="Estimated context usage"
            aria-valuemin="0"
            aria-valuemax=${LIMIT}
            aria-valuenow=${Math.min(LIMIT, total)}
            aria-valuetext=${`Approximately ${total} of ${LIMIT} tokens`}
          >
            ${categories.map(
              ([key, , color]) =>
                html`<span
                  class="context-segment"
                  style=${`background:${color};width:${
                    (counts[key] / Math.max(LIMIT, total)) * 100
                  }%`}
                ></span>`,
            )}
            <span class="context-threshold"></span>
          </div>
          <span class="context-value">~${format(total)} / 256K</span>
          <div class="context-popover" id="context-breakdown" role="tooltip">
            <strong>Context breakdown</strong>
            ${categories.map(
              ([key, label, color]) => html`
                <div class="context-detail">
                  <span class="context-dot" style=${`background:${color}`}></span
                  ><span>${label}</span><span class="context-count">~${format(counts[key])}</span>
                </div>
              `,
            )}
            <p>
              Estimated tokens. System and tool definitions use fixed allowances; message text uses
              characters ÷ 4. Reasoning, attachments, and protocol overhead aren’t counted.
            </p>
          </div>
        `,
        node,
      );
    },
  };
}
