/** Model loop. Submits a turn, streams into the session, runs tools until the model stops. */
import type { Message, Tool as PiTool } from "@earendil-works/pi-ai";

import type { PluginContext } from "../sdk.ts";

import { Service } from "cordis";

declare module "../sdk.ts" {
  interface Services {
    agent: Agent;
  }
}

export default class Agent extends Service {
  static inject = ["sessions", "model", "tools", "workspace"] as const;
  static provide = "agent" as const;
  declare ctx: PluginContext<"sessions" | "model" | "tools" | "workspace">;

  private runs = new Map<string, AbortController>();

  constructor(ctx: PluginContext<"sessions" | "model" | "tools" | "workspace">) {
    super(ctx, "agent");
    ctx.effect(() => () => {
      for (const run of this.runs.values()) run.abort();
    });
  }

  stop(sessionId: string) {
    this.runs.get(sessionId)?.abort();
  }

  async submit(sessionId: string, text: string) {
    const session = this.ctx.sessions.get(sessionId);
    if (session.status === "running") {
      throw new Error("This chat is already running");
    }
    this.ctx.sessions.append(sessionId, {
      role: "user",
      content: text,
      timestamp: Date.now(),
    });
    const run = new AbortController();
    this.runs.set(sessionId, run);
    this.ctx.sessions.setStatus(sessionId, "running");
    try {
      await this.drive(sessionId, run.signal);
      this.ctx.sessions.setStatus(sessionId, "idle");
    } catch {
      this.ctx.sessions.setStatus(sessionId, run.signal.aborted ? "idle" : "error");
    } finally {
      this.runs.delete(sessionId);
    }
  }

  private async drive(sessionId: string, signal: AbortSignal) {
    const session = this.ctx.sessions.get(sessionId);
    const model = await this.ctx.model.resolve(session.provider, session.model);
    this.ctx.sessions.update(sessionId, {
      provider: model.provider,
      model: model.id,
    });
    for (let step = 0; step < 32; step++) {
      signal.throwIfAborted();
      const tools = this.ctx.tools.list().map((tool): PiTool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
      const stream = this.ctx.model.stream(
        model,
        {
          systemPrompt: prompt(this.ctx.workspace.root),
          messages: this.ctx.sessions.messages(sessionId),
          tools,
        },
        { signal },
      );
      let started = false;
      let checkpoint = 0;
      for await (const event of stream) {
        if (!("partial" in event)) continue;
        const partial = event.partial as Message;
        if (!started) {
          this.ctx.sessions.append(sessionId, partial);
          started = true;
          checkpoint = Date.now();
        } else if (Date.now() - checkpoint > 80) {
          this.ctx.sessions.replaceLast(sessionId, partial);
          checkpoint = Date.now();
        }
      }
      const reply = await stream.result();
      if (started) this.ctx.sessions.replaceLast(sessionId, reply);
      else this.ctx.sessions.append(sessionId, reply);
      if (reply.stopReason === "error") {
        throw new Error(reply.errorMessage ?? "Provider request failed");
      }
      const calls = reply.content.filter((block) => block.type === "toolCall");
      if (!calls.length) return;
      for (const call of calls) {
        signal.throwIfAborted();
        let result = "";
        let isError = false;
        try {
          result = await this.ctx.tools.call(call.name, call.arguments, {
            sessionId,
            signal,
          });
        } catch (error) {
          isError = true;
          result = signal.aborted
            ? "Cancelled."
            : error instanceof Error
              ? error.message
              : String(error);
        }
        this.ctx.sessions.append(sessionId, {
          role: "toolResult",
          toolCallId: call.id,
          toolName: call.name,
          content: [{ type: "text", text: result.slice(0, 100_000) }],
          isError,
          timestamp: Date.now(),
        });
      }
    }
    throw new Error("Step limit reached. Send another message to continue.");
  }
}

function prompt(root: string) {
  return `You are Fathom, a coding agent working in ${root}.
Use read, write, edit, bash, and script to inspect and change the workspace.
Prefer read before write or edit. Keep command output short.`;
}
