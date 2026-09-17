import type { ToolBatch } from "../../models/tool-execution.ts";

import { html, nothing } from "lit";

import { DesignElement } from "../../foundation/design-element.ts";
import { icon } from "../../primitives/icon.ts";

export class ToolExecutionElement extends DesignElement {
  static override properties = { batch: { attribute: false } };
  declare batch: ToolBatch;

  override render() {
    if (!this.batch) return nothing;
    const { tools, state } = this.batch;
    const active = tools.find((tool) => tool.state === "running");
    const last = tools.at(-1);
    const counts = (["read", "edited", "written"] as const)
      .map((action) => {
        const count = new Set(
          tools
            .filter((tool) => tool.action === action && tool.state === "completed")
            .map((tool) => tool.target),
        ).size;
        return count ? `${count} ${count === 1 ? "file" : "files"} ${action}` : "";
      })
      .filter(Boolean);
    const otherCompleted = tools.filter(
      (tool) => !tool.action && tool.state === "completed",
    ).length;
    if (otherCompleted) {
      counts.push(`${otherCompleted} ${otherCompleted === 1 ? "tool" : "tools"} ran`);
    }
    const failed = tools.filter((tool) => tool.state === "error").length;
    if (failed) counts.push(`${failed} failed`);
    const pastAction =
      last?.state === "error"
        ? "Failed"
        : last?.action === "edited"
          ? "Edited file"
          : last?.action === "written"
            ? "Wrote file"
            : last?.action === "read"
              ? "Read file"
              : last?.name === "Run command"
                ? "Ran command"
                : "Executed tool";
    const label =
      state === "thinking"
        ? "Thinking…"
        : active
          ? `${active.name} · ${active.target}`
          : state === "running" && last
            ? `${pastAction} · ${last.target}`
            : counts.join(" · ") || `${tools.length} tools ran`;
    return html`
      <details class="group text-sm text-muted">
        <summary class="flex items-baseline gap-2 py-2">
          <span class="group-open:rotate-90">${icon("caret-right", "small")}</span>
          <span
            class="min-w-0 break-words ${state !== "completed" ? "tool-execution-working" : ""}"
            aria-live="polite"
            >${label}</span
          >
        </summary>
        <div class="mt-2 flex flex-col gap-3">
          ${tools.map(
            (tool) => html`
              <details
                class="rounded-lg border border-line bg-surface"
                ?open=${tool.state === "running"}
              >
                <summary class="flex flex-wrap items-baseline justify-between gap-2 p-3">
                  <span class="min-w-0 break-words text-ink">${tool.name} · ${tool.target}</span>
                  <span class="${tool.state === "error" ? "text-danger" : "text-muted"}"
                    >${
                      tool.state === "running"
                        ? "Running"
                        : tool.state === "error"
                          ? "Failed"
                          : tool.duration
                    }</span
                  >
                </summary>
                <div class="border-t border-line p-3">
                  <p class="mb-2 text-xs font-medium">Call</p>
                  <pre
                    class="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-control bg-canvas p-3 font-mono text-xs"
                    tabindex="0"
                    aria-label="${tool.name} arguments"
                  >
${tool.arguments}</pre>
                  <div class="mb-2 mt-3 flex justify-between gap-2">
                    <p class="text-xs font-medium">Result</p>
                    <span class="text-xs">Drag to resize</span>
                  </div>
                  <pre
                    class="h-40 min-h-24 resize-y overflow-auto whitespace-pre-wrap break-words rounded-control border border-line bg-canvas p-3 font-mono text-xs"
                    tabindex="0"
                    aria-label="${tool.name} result"
                  >
${tool.result || "Waiting for output…"}</pre>
                </div>
              </details>
            `,
          )}
          ${!tools.length ? html`<p class="p-3">No tool calls in this batch yet.</p>` : nothing}
        </div>
      </details>
    `;
  }
}

customElements.define("tool-execution", ToolExecutionElement);
