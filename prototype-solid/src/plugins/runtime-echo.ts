import { definePlugin } from "../kernel/plugin.ts";
export default definePlugin({
  id: "runtime-echo",
  apiVersion: 1,
  provides: ["runtime"],
  requires: ["sessions"],
  activate(ctx) {
    const sessions = ctx.get("sessions");
    ctx.provide("runtime", {
      id: "echo",
      run(text, signal) {
        signal.throwIfAborted();
        sessions.append({ role: "user", text });
        sessions.append({
          role: "assistant",
          text: `Echo runtime received: ${text}\n\nThis is a different runtime plugin. No model request or tool execution occurred. The desktop UI and session service are unchanged.`,
        });
        return Promise.resolve();
      },
    });
  },
});
