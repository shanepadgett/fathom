export const LIMIT = 256_000;
export const categories = [
  ["system", "System prompt", "#8072b3"],
  ["tools", "Tool definitions", "#c39932"],
  ["user", "User messages", "#347caa"],
  ["assistant", "Assistant messages", "#e76535"],
  ["calls", "Tool calls", "#b45379"],
  ["results", "Tool results", "#478773"],
];
const tokens = (text = "") => Math.ceil(text.length / 4);
export const format = (value) =>
  value < 1000 ? String(value) : `${+(value / 1000).toFixed(1)}K`;

// The transcript is a display projection, not the exact provider request.
// Keep the existing fixed allowance explicit until runtime accounting is exposed.
export function estimate(session, liveText) {
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
      counts.calls += tokens(
        (message.toolName || "") + JSON.stringify(message.args || {}),
      );
    } else if (message.role === "user" || message.role === "assistant") {
      counts[message.role] += tokens(message.text);
    }
  }
  return counts;
}
