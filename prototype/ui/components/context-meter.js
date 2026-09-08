import { el } from "../core/dom.js";

const LIMIT = 256_000;
const categories = [
  ["system", "System prompt", "#8072b3"],
  ["tools", "Tool definitions", "#c39932"],
  ["user", "User messages", "#347caa"],
  ["assistant", "Assistant messages", "#e76535"],
  ["calls", "Tool calls", "#b45379"],
  ["results", "Tool results", "#478773"],
];
const tokens = (text = "") => Math.ceil(text.length / 4);
const format = (value) => (value < 1000 ? String(value) : `${+(value / 1000).toFixed(1)}K`);

// The transcript is a display projection, not the exact provider request.
// Keep the existing fixed allowance explicit until runtime accounting is exposed.
function estimate(session, liveText) {
  const counts = {
    system: 500,
    tools: 2000,
    user: 0,
    assistant: tokens(liveText),
    calls: 0,
    results: 0,
  };
  for (const message of session.messages) {
    if (message.role === "tool") {
      counts.results += tokens(message.text);
      counts.calls += tokens((message.toolName || "") + JSON.stringify(message.args || {}));
    } else if (message.role === "user" || message.role === "assistant") {
      counts[message.role] += tokens(message.text);
    }
  }
  return counts;
}

export function createContextMeter() {
  const track = el("div", {
    class: "context-track",
    role: "progressbar",
    "aria-label": "Estimated context usage",
    "aria-valuemin": "0",
    "aria-valuemax": String(LIMIT),
  });
  const value = el("span", { class: "context-value" });
  const rows = new Map();
  const segments = new Map();
  const popover = el(
    "div",
    {
      class: "context-popover",
      id: "context-breakdown",
      role: "tooltip",
    },
    el("strong", {}, "Context breakdown"),
  );
  for (const [key, label, color] of categories) {
    const segment = el("span", {
      class: "context-segment",
      style: `background:${color}`,
    });
    segments.set(key, segment);
    track.append(segment);
    const count = el("span", { class: "context-count" });
    rows.set(key, count);
    popover.append(
      el(
        "div",
        { class: "context-detail" },
        el("span", { class: "context-dot", style: `background:${color}` }),
        el("span", {}, label),
        count,
      ),
    );
  }
  popover.append(
    el(
      "p",
      {},
      "Estimated tokens. System and tool definitions use fixed allowances; message text uses characters ÷ 4. Reasoning, attachments, and protocol overhead aren’t counted.",
    ),
  );
  track.append(el("span", { class: "context-threshold" }));
  const node = el(
    "div",
    {
      class: "context-meter",
      tabindex: "0",
      "aria-describedby": "context-breakdown",
      style: "--threshold-position:78.125%",
    },
    el("span", { class: "context-label" }, "Context"),
    track,
    value,
    popover,
  );
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
      for (const [key] of categories) {
        segments.get(key).style.width = `${(counts[key] / Math.max(LIMIT, total)) * 100}%`;
        rows.get(key).textContent = `~${format(counts[key])}`;
      }
      value.textContent = `~${format(total)} / 256K`;
      track.setAttribute("aria-valuenow", String(Math.min(LIMIT, total)));
      track.setAttribute("aria-valuetext", `Approximately ${total} of ${LIMIT} tokens`);
    },
  };
}
