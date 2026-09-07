import type { ContextService } from "../../contracts/context.ts";
import type { ModelService } from "../../contracts/model.ts";
import type { SessionService } from "../../contracts/session.ts";
import type { ToolRegistry } from "../../contracts/tools.ts";
export async function runLoop(
  text: string,
  signal: AbortSignal,
  deps: {
    model: ModelService;
    sessions: SessionService;
    tools: ToolRegistry;
    context: ContextService;
  },
) {
  const { model, sessions, tools, context } = deps;
  sessions.history.push({ role: "user", text });
  sessions.append({ role: "user", text });
  for (let step = 0; step < 16; step++) {
    signal.throwIfAborted();
    const reply = await model.respond({
      ...context.build({
        messages: sessions.history,
        tools: tools.list().map(({ name, description, parameters }) => ({
          name,
          description,
          parameters,
        })),
      }),
      signal,
      onText: (text) => sessions.publish({ type: "delta", text }),
    });
    sessions.history.push({ role: "assistant", reply });
    // Settlement clears transient output, even for tool-only responses.
    if (reply.text) sessions.append({ role: "assistant", text: reply.text });
    else sessions.publish({ type: "snapshot", session: sessions.snapshot() });
    for (const call of reply.calls) {
      let result: string;
      let isError = false;
      try {
        signal.throwIfAborted();
        sessions.publish({
          type: "tool-start",
          name: call.name,
          args: call.arguments,
        });
        result = await tools.execute(call.name, call.arguments, signal);
      } catch (error) {
        isError = true;
        result = error instanceof Error ? error.message : String(error);
      }
      // Always settle every call, including unexecuted calls after cancellation.
      sessions.history.push({ role: "tool", call, text: result, isError });
      sessions.append({
        role: "tool",
        toolName: call.name,
        args: call.arguments,
        text: result,
        isError,
      });
    }
    signal.throwIfAborted();
    if (reply.stop === "length") {
      throw new Error(
        "Model output limit reached. Send a follow-up to continue.",
      );
    }
    if (!reply.calls.length) return;
  }
  throw new Error(
    "Prototype step limit (16) reached. Send a follow-up to continue.",
  );
}
