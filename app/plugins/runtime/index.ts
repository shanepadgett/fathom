import type { AssistantMessage, ToolCall } from "@earendil-works/pi-ai";

import type {
  Entry,
  EntryAttachment,
  RuntimeService,
  ToolExecution,
} from "../../sdk/mod.ts";
import type { RunInput, ToolInput } from "../../sdk/hooks.ts";

import { calculateCost, clampThinkingLevel } from "@earendil-works/pi-ai";
import { Value } from "typebox/value";

import { definePlugin } from "../../sdk/mod.ts";

interface ActiveRun {
  controller: AbortController;
  done: Promise<void>;
  wake?: () => void;
  activity?: { label: string; since: number };
}
interface Queued {
  id: string;
  text: string;
  mode: "steer" | "follow_up";
  attachments?: EntryAttachment[];
}

export default definePlugin({
  id: "fathom:runtime",
  apiVersion: 1,
  backend: {
    requires: [
      "storage",
      "model",
      "context",
      "compaction",
      "tools",
      "approvals",
      "events",
    ],
    provides: ["runtime"],
    activate(ctx) {
      const storage = ctx.get("storage"),
        modelService = ctx.get("model"),
        context = ctx.get("context"),
        compaction = ctx.get("compaction"),
        tools = ctx.get("tools"),
        approvals = ctx.get("approvals"),
        events = ctx.get("events");
      const active = new Map<string, ActiveRun>();
      const admitting = new Map<string, Promise<void>>();
      let disposing = false;
      const queue = (id: string) =>
        storage.setting<Queued[]>(`queue:${id}`, []);
      const publish = (id: string) =>
        events.publish({ type: "session", sessionId: id });
      const appendUser = (
        id: string,
        text: string,
        attachments?: EntryAttachment[],
        source?: Entry["source"],
      ) =>
        storage.append(id, {
          kind: "message",
          status: "completed",
          message: { role: "user", content: text, timestamp: Date.now() },
          attachments,
          source,
        });

      function flushSteering(sessionId: string) {
        storage.transaction(() => {
          const pending = queue(sessionId);
          for (const item of pending.filter((item) => item.mode === "steer")) {
            appendUser(sessionId, item.text, item.attachments);
          }
          storage.setSetting(
            `queue:${sessionId}`,
            pending.filter((item) => item.mode !== "steer"),
          );
        });
      }

      function reconcile(sessionId: string) {
        if (active.has(sessionId) || admitting.has(sessionId)) return;
        const entries = storage.entries(sessionId);
        const results = new Set(
          entries.flatMap((entry) =>
            entry.message?.role === "toolResult"
              ? [entry.message.toolCallId]
              : []
          ),
        );
        storage.transaction(() => {
          for (const entry of entries) {
            if (entry.status === "pending") {
              storage.updateEntry(entry.id, { status: "interrupted" });
            }
            if (entry.message?.role !== "assistant") continue;
            for (
              const call of entry.message.content.filter((block) =>
                block.type === "toolCall"
              )
            ) {
              if (!results.has(call.id)) {
                storage.append(sessionId, {
                  kind: "message",
                  status: "interrupted",
                  message: {
                    role: "toolResult",
                    toolCallId: call.id,
                    toolName: call.name,
                    content: [{
                      type: "text",
                      text:
                        "Interrupted before a result was recorded. This action was not re-executed.",
                    }],
                    isError: true,
                    timestamp: Date.now(),
                  },
                });
              }
            }
          }
          for (const execution of storage.executions(sessionId)) {
            if (["pending", "running"].includes(execution.status)) {
              storage.saveExecution({
                ...execution,
                status: "aborted",
                result: "Interrupted before completion.",
              });
            }
          }
          if (
            ["running", "retry_waiting", "approval"].includes(
              storage.getSession(sessionId).status,
            )
          ) storage.updateSession(sessionId, { status: "interrupted" });
        });
      }

      async function execute(
        sessionId: string,
        entryId: string,
        call: ToolCall,
        signal: AbortSignal,
      ) {
        const execution: ToolExecution = {
          id: call.id,
          sessionId,
          entryId,
          name: call.name,
          args: call.arguments,
          status: "running",
          startedAt: Date.now(),
        };
        storage.saveExecution(execution);
        publish(sessionId);
        const input: ToolInput = {
          sessionId,
          callId: call.id,
          name: call.name,
          args: call.arguments,
          signal,
          report: (text) =>
            events.publish({
              type: "tool-output",
              sessionId,
              data: { callId: call.id, text },
            }),
        };
        let result = "", isError = false;
        try {
          signal.throwIfAborted();
          const tool = tools.list(sessionId).find((tool) =>
            tool.name === call.name
          );
          if (!tool) {
            throw new Error(`Tool is unavailable or disallowed: ${call.name}`);
          }
          if (!Value.Check(tool.parameters, call.arguments)) {
            throw new Error("Tool arguments do not match its schema");
          }
          const decision = await ctx.cordis.serial("tool:before", input);
          if (decision?.action === "block") throw new Error(decision.reason);
          if (decision?.action === "mock") result = decision.result;
          else {
            await approvals.request(
              input,
              decision?.action === "prompt_user"
                ? decision.explanation
                : undefined,
            );
            signal.throwIfAborted();
            await ctx.cordis.parallel("tool:execute", input);
            result = await tool.execute(call.arguments, input);
          }
          const after = { ...input, result, isError };
          await ctx.cordis.parallel("tool:after", after);
          result = after.result;
        } catch (error) {
          isError = true;
          result = signal.aborted
            ? "Tool execution cancelled by user."
            : error instanceof Error
            ? error.message
            : String(error);
        }
        const bounded = result.length > 100_000
          ? result.slice(0, 50_000) + "\n[Output truncated]\n" +
            result.slice(-50_000)
          : result;
        storage.transaction(() => {
          storage.append(sessionId, {
            kind: "message",
            status: signal.aborted ? "interrupted" : "completed",
            message: {
              role: "toolResult",
              toolCallId: call.id,
              toolName: call.name,
              content: [{ type: "text", text: bounded }],
              isError,
              timestamp: Date.now(),
            },
          });
          storage.saveExecution({
            ...execution,
            status: signal.aborted
              ? "aborted"
              : isError
              ? "error"
              : "completed",
            result: bounded,
            durationMs: Date.now() - execution.startedAt,
          });
        });
        publish(sessionId);
      }

      async function drive(sessionId: string, run: ActiveRun) {
        const signal = run.controller.signal;
        const activity = (label: string) => {
          if (run.activity?.label === label) return;
          run.activity = { label, since: Date.now() };
          publish(sessionId);
        };
        try {
          storage.updateSession(sessionId, { status: "running" });
          activity("Starting run");
          await ctx.cordis.parallel("run:start", { sessionId });
          let steps = 0;
          while (!signal.aborted) {
            activity("Preparing context");
            if (++steps > storage.setting("maxSteps", 200)) {
              throw new Error(
                "Step limit reached. Continue to resume this task.",
              );
            }
            flushSteering(sessionId);
            const model = await modelService.select(sessionId);
            const session = storage.getSession(sessionId);
            if (
              session.provider && session.provider !== model.provider
            ) throw new Error("Fork this branch before switching provider");
            storage.updateSession(sessionId, {
              provider: model.provider,
              model: model.id,
            });
            let reply: AssistantMessage | undefined;
            let entryId: string | undefined;
            let compacted = false;
            for (let attempt = 0; attempt < 5; attempt++) {
              activity("Preparing context");
              signal.throwIfAborted();
              flushSteering(sessionId);
              const input = {
                sessionId,
                context: await context.assemble(sessionId),
                signal,
              };
              const outputLimit = Math.min(16384, model.maxTokens);
              const exceedsBudget = () =>
                Math.ceil(JSON.stringify(input.context).length / 3) +
                    outputLimit > model.contextWindow * 0.9;
              if (exceedsBudget()) {
                if (compacted) {
                  throw new Error(
                    "Context still exceeds this model's window after compaction. Shorten the request or fork a new session.",
                  );
                }
                activity("Compacting context");
                await compaction.compact(sessionId, signal);
                compacted = true;
                input.context = await context.assemble(sessionId);
                if (exceedsBudget()) {
                  throw new Error(
                    "Protected context and recent work exceed this model's window. Shorten the request or fork a new session.",
                  );
                }
              }
              activity("Preparing model input");
              const projection = await ctx.cordis.serial("step:before", input);
              if (projection) input.context.messages = projection.messages;
              await ctx.cordis.parallel("step:model", input);
              activity("Waiting for provider");
              const startedAt = Date.now();
              const reasoning = clampThinkingLevel(model, session.thinking);
              const stream = modelService.models.streamSimple(
                model,
                input.context,
                {
                  signal,
                  reasoning: reasoning === "off" ? undefined : reasoning,
                  maxTokens: outputLimit,
                  transport: "sse",
                },
              );
              let checkpoint = Date.now();
              for await (const event of stream) {
                if (event.type.endsWith("_delta")) {
                  activity("Receiving response");
                }
                if (event.type === "start") {
                  entryId = storage.append(sessionId, {
                    kind: "message",
                    status: "pending",
                    message: structuredClone(event.partial),
                  }).id;
                }
                if ("partial" in event) {
                  events.publish({
                    type: "stream",
                    sessionId,
                    data: { entryId, message: event.partial },
                  });
                  if (entryId && Date.now() - checkpoint > 2000) {
                    storage.updateEntry(entryId, {
                      message: structuredClone(event.partial),
                    });
                    checkpoint = Date.now();
                  }
                }
              }
              reply = await stream.result();
              const status = signal.aborted || reply.stopReason === "aborted"
                ? "interrupted"
                : reply.stopReason === "error"
                ? "error"
                : "completed";
              if (entryId) {
                storage.updateEntry(entryId, {
                  message: reply,
                  status,
                });
              } else {entryId = storage.append(sessionId, {
                  kind: "message",
                  status,
                  message: reply,
                }).id;}
              calculateCost(model, reply.usage);
              storage.recordUsage({
                id: crypto.randomUUID(),
                pluginId: "fathom:runtime",
                purpose: "agent",
                sessionId,
                model: model.id,
                provider: model.provider,
                usage: reply.usage,
                durationMs: Date.now() - startedAt,
                createdAt: Date.now(),
              });
              if (reply.stopReason === "aborted") run.controller.abort();
              signal.throwIfAborted();
              if (reply.stopReason !== "error") break;
              for (
                const call of reply.content.filter((block) =>
                  block.type === "toolCall"
                )
              ) {
                storage.append(sessionId, {
                  kind: "message",
                  status: "error",
                  message: {
                    role: "toolResult",
                    toolCallId: call.id,
                    toolName: call.name,
                    content: [{
                      type: "text",
                      text:
                        "Provider generation failed. This tool was not executed.",
                    }],
                    isError: true,
                    timestamp: Date.now(),
                  },
                });
              }
              if (
                /context_length_exceeded|maximum context length|context window|prompt is too long|input.{0,30}exceed.{0,30}token/i
                  .test(reply.errorMessage ?? "")
              ) {
                if (compacted) {
                  throw new Error(
                    "The provider still rejected the context after compaction. Shorten the request or fork a new session.",
                  );
                }
                activity("Compacting context");
                await compaction.compact(sessionId, signal);
                compacted = true;
                entryId = undefined;
                attempt--;
                continue;
              }
              if (
                !/429|503|rate.limit|overloaded|capacity|network|fetch failed/i
                  .test(reply.errorMessage ?? "") || attempt === 4
              ) {
                throw new Error(
                  reply.errorMessage ?? "Provider request failed",
                );
              }
              const delay = Math.min(30_000, 1000 * 2 ** attempt) +
                Math.random() * 500;
              storage.updateSession(sessionId, { status: "retry_waiting" });
              activity("Waiting to retry");
              events.publish({
                type: "retry",
                sessionId,
                data: { attempt: attempt + 1, until: Date.now() + delay },
              });
              await new Promise<void>((resolve) => {
                const done = () => {
                  clearTimeout(timer);
                  signal.removeEventListener("abort", done);
                  delete run.wake;
                  resolve();
                };
                const timer = setTimeout(done, delay);
                run.wake = done;
                signal.addEventListener("abort", done, { once: true });
              });
              storage.updateSession(sessionId, { status: "running" });
              entryId = undefined;
            }
            if (!reply || !entryId) {
              throw new Error(
                "Provider returned no response",
              );
            }
            const calls = reply.content.filter((block) =>
              block.type === "toolCall"
            );
            const mode = storage.setting<string>("toolExecution", "adaptive");
            if (calls.length) activity("Executing tools");
            let batch: Promise<void>[] = [];
            for (const call of calls) {
              if (
                mode === "parallel" ||
                (mode === "adaptive" && tools.get(call.name)?.readOnly)
              ) batch.push(execute(sessionId, entryId, call, signal));
              else {
                await Promise.all(batch);
                batch = [];
                await execute(sessionId, entryId, call, signal);
              }
            }
            await Promise.all(batch);
            signal.throwIfAborted();
            activity("Reviewing step");
            const decision = await ctx.cordis.serial("step:after", {
              sessionId,
              reply,
              signal,
            });
            if (decision?.action === "continue") {
              appendUser(
                sessionId,
                decision.prompt,
                undefined,
                decision.source ?? {
                  pluginId: "fathom:runtime",
                  label: "Harness feedback",
                },
              );
              continue;
            }
            if (
              !calls.length &&
              !queue(sessionId).some((item) => item.mode === "steer")
            ) {
              if (reply.stopReason === "length") {
                throw new Error(
                  "Response reached its output limit. Continue to resume.",
                );
              }
              break;
            }
          }
          signal.throwIfAborted();
          storage.updateSession(sessionId, { status: "idle" });
        } catch (error) {
          storage.updateSession(sessionId, {
            status: signal.aborted ? "interrupted" : "error",
          });
          if (!signal.aborted) {
            events.publish({
              type: "error",
              sessionId,
              data: {
                message: error instanceof Error ? error.message : String(error),
              },
            });
          }
        } finally {
          activity("Finishing run");
          try {
            await ctx.cordis.parallel("run:finish", { sessionId });
          } catch (error) {
            events.publish({
              type: "error",
              sessionId,
              data: { message: `Settlement hook failed: ${error}` },
            });
          }
          active.delete(sessionId);
          reconcile(sessionId);
          publish(sessionId);
          const settled = storage.getSession(sessionId);
          if (
            !disposing &&
            ["idle", "error", "interrupted"].includes(settled.status)
          ) {
            events.publish({
              type: "attention",
              sessionId,
              data: {
                kind: settled.status === "idle" ? "success" : "error",
                title: settled.status === "idle"
                  ? "Fathom finished"
                  : "Fathom needs attention",
                body: settled.title,
              },
            });
          }
          try {
            await ctx.cordis.parallel("session:idle", sessionId);
          } catch (error) {
            events.publish({
              type: "error",
              sessionId,
              data: { message: `Idle hook failed: ${error}` },
            });
          }
          if (
            !disposing && !signal.aborted &&
            storage.getSession(sessionId).status === "idle"
          ) {
            const next = queue(sessionId)[0];
            if (next) {
              await submit(
                sessionId,
                next.text,
                undefined,
                next.attachments,
                next.id,
              );
            }
          }
        }
      }

      function start(sessionId: string) {
        const run: ActiveRun = {
          controller: new AbortController(),
          done: Promise.resolve(),
        };
        active.set(sessionId, run);
        run.done = drive(sessionId, run).catch((error) => {
          events.publish({
            type: "error",
            sessionId,
            data: { message: `Run settlement failed: ${error}` },
          });
        });
      }

      async function submit(
        sessionId: string,
        text: string,
        mode: "steer" | "follow_up" = "steer",
        attachments?: EntryAttachment[],
        queuedId?: string,
      ) {
        if (!text.trim() || text.length > 200_000) {
          throw new Error(
            "Enter a prompt of at most 200,000 characters",
          );
        }
        storage.getSession(sessionId);
        if (active.has(sessionId) || admitting.has(sessionId)) {
          if (queuedId) return;
          storage.setSetting(`queue:${sessionId}`, [...queue(sessionId), {
            id: crypto.randomUUID(),
            text,
            mode,
            attachments,
          }]);
          if (mode === "steer") active.get(sessionId)?.wake?.();
          publish(sessionId);
          return;
        }
        const admission = (async () => {
          reconcile(sessionId);
          const input: RunInput = {
            sessionId,
            text,
            attachments,
            signal: new AbortController().signal,
          };
          await ctx.cordis.serial("run:admit", input);
          storage.transaction(() => {
            if (queuedId) {
              const current = queue(sessionId).find((item) =>
                item.id === queuedId
              );
              if (!current || current.text !== text) {
                throw new Error(
                  "Queued message changed during admission. Review the queue before continuing.",
                );
              }
              storage.setSetting(
                `queue:${sessionId}`,
                queue(sessionId).filter((item) => item.id !== queuedId),
              );
            }
            const entry = appendUser(
              sessionId,
              input.text,
              input.attachments,
            );
            if (input.snapshotTreeId) {
              storage.updateEntry(entry.id, {
                snapshotTreeId: input.snapshotTreeId,
              });
            }
            if (
              storage.getSession(sessionId).title === "New session"
            ) {
              storage.updateSession(sessionId, {
                title: input.text.slice(0, 70),
              });
            }
          });
          start(sessionId);
        })();
        admitting.set(sessionId, admission);
        try {
          await admission;
        } finally {
          admitting.delete(sessionId);
          publish(sessionId);
        }
      }

      const service: RuntimeService = {
        updateQueued(sessionId, id, text) {
          storage.getSession(sessionId);
          if (text !== null && (!text.trim() || text.length > 200_000)) {
            throw new Error("Enter a prompt of at most 200,000 characters");
          }
          const pending = queue(sessionId);
          if (!pending.some((item) => item.id === id)) {
            throw new Error(
              "This message has already left the queue. Check the conversation before sending another.",
            );
          }
          storage.setSetting(
            `queue:${sessionId}`,
            text === null
              ? pending.filter((item) => item.id !== id)
              : pending.map((item) =>
                item.id === id ? { ...item, text } : item
              ),
          );
          publish(sessionId);
        },
        submit,
        async sendQueued(sessionId, id) {
          if (active.has(sessionId) || admitting.has(sessionId)) {
            throw new Error(
              "Wait for the current run to finish before sending queued work.",
            );
          }
          const item = queue(sessionId).find((item) => item.id === id);
          if (!item) {
            throw new Error("This message has already left the queue.");
          }
          await submit(
            sessionId,
            item.text,
            item.mode,
            item.attachments,
            item.id,
          );
        },
        async resume(sessionId) {
          if (active.has(sessionId) || admitting.has(sessionId)) return;
          reconcile(sessionId);
          if (!storage.entries(sessionId).length) {
            throw new Error(
              "Send a prompt to start this session",
            );
          }
          start(sessionId);
        },
        abort(sessionId) {
          active.get(sessionId)?.controller.abort();
        },
        async whenIdle(sessionId) {
          await admitting.get(sessionId);
          while (active.has(sessionId)) await active.get(sessionId)!.done;
        },
        state(sessionId) {
          reconcile(sessionId);
          const session = storage.getSession(sessionId);
          return {
            session: admitting.has(sessionId) && !active.has(sessionId)
              ? { ...session, status: "running" as const }
              : session,
            entries: storage.entries(sessionId),
            executions: storage.executions(sessionId),
            queued: queue(sessionId),
            activity: active.get(sessionId)?.activity,
          };
        },
      };
      ctx.provide("runtime", service);
      ctx.effect(() => async () => {
        disposing = true;
        await Promise.allSettled(admitting.values());
        for (const run of active.values()) run.controller.abort();
        await Promise.allSettled([...active.values()].map((run) => run.done));
      });
    },
  },
});
