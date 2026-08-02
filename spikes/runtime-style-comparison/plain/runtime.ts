import type { AssistantMessage, Context, ToolCall } from "@earendil-works/pi-ai";
import {
  defaultPolicy,
  type Dependencies,
  initialContext,
  isTransient,
  type RuntimeEvent,
  type RuntimePolicy,
  toolResult,
} from "../shared.ts";

export class PlainRuntimeError extends Error {
  constructor(readonly kind: "model" | "approval" | "tool" | "persistence", cause: unknown) {
    super(`${kind}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}

export async function* runPlain(
  prompt: string,
  dependencies: Dependencies,
  signal: AbortSignal,
  policy: RuntimePolicy = defaultPolicy,
): AsyncGenerator<RuntimeEvent> {
  const runId = crypto.randomUUID();
  const context = initialContext(prompt);
  yield { type: "run_started", runId };

  try {
    await persist(dependencies, { runId, kind: "user", value: context.messages[0] });
    while (true) {
      const turn = modelTurn(context, dependencies, signal, policy);
      let next = await turn.next();
      while (!next.done) {
        yield next.value;
        next = await turn.next();
      }
      const assistant = next.value;
      context.messages.push(assistant);
      await persist(dependencies, { runId, kind: "assistant", value: assistant });

      const calls = assistant.content.filter((part): part is ToolCall => part.type === "toolCall");
      if (calls.length === 0) break;
      for (const call of calls) {
        yield { type: "approval_requested", toolCallId: call.id, toolName: call.name };
      }
      const approvals = await mapConcurrent(
        calls,
        policy.toolConcurrency,
        (call) =>
          dependencies.approve(
            call.id,
            call.name,
            AbortSignal.any([signal, AbortSignal.timeout(policy.toolTimeoutMs)]),
          ).catch((cause) => {
            throw new PlainRuntimeError("approval", cause);
          }),
      );
      for (let index = 0; index < calls.length; index++) {
        const call = calls[index];
        const approved = approvals[index];
        yield { type: "approval_resolved", toolCallId: call.id, approved };
        if (!approved) throw new PlainRuntimeError("approval", "Approval denied");
      }
      const outputs = await mapConcurrent(calls, policy.toolConcurrency, async (call) => {
        const path = call.arguments.path;
        if (call.name !== "inspect_workspace" || typeof path !== "string") {
          throw new PlainRuntimeError("tool", "Invalid tool call");
        }
        const toolSignal = AbortSignal.any([signal, AbortSignal.timeout(policy.toolTimeoutMs)]);
        const output = await dependencies.inspectWorkspace(path, toolSignal).catch((cause) => {
          throw new PlainRuntimeError("tool", cause);
        });
        return output;
      });
      for (let index = 0; index < calls.length; index++) {
        const call = calls[index];
        const output = outputs[index];
        const result = toolResult(call, output);
        context.messages.push(result);
        await persist(dependencies, { runId, kind: "tool", value: result });
        yield { type: "tool_finished", toolCallId: call.id, output };
      }
    }
    yield { type: "run_finished", runId };
  } finally {
    await dependencies.disposeExtension();
    yield { type: "extension_disposed", extensionId: "workspace" };
  }
}

async function* modelTurn(
  context: Context,
  dependencies: Dependencies,
  signal: AbortSignal,
  policy: RuntimePolicy,
): AsyncGenerator<RuntimeEvent, AssistantMessage> {
  for (let attempt = 1; attempt <= policy.modelAttempts; attempt++) {
    let emitted = false;
    try {
      const attemptSignal = AbortSignal.any([
        signal,
        AbortSignal.timeout(policy.modelTimeoutMs),
      ]);
      const response = dependencies.stream(context, attemptSignal);
      for await (const event of response) {
        if (event.type === "text_delta") {
          emitted = true;
          yield { type: "text_delta", delta: event.delta };
        }
      }
      return await response.result();
    } catch (cause) {
      if (emitted || attempt === policy.modelAttempts || !isTransient(cause)) {
        throw new PlainRuntimeError("model", cause);
      }
      await abortableDelay(policy.retryDelayMs, signal);
    }
  }
  throw new PlainRuntimeError("model", "Retry loop exhausted");
}

async function persist(dependencies: Dependencies, record: Parameters<Dependencies["persist"]>[0]) {
  await dependencies.persist(record).catch((cause) => {
    throw new PlainRuntimeError("persistence", cause);
  });
}

async function mapConcurrent<A, B>(
  values: readonly A[],
  concurrency: number,
  run: (value: A) => Promise<B>,
): Promise<B[]> {
  const results = new Array<B>(values.length);
  let next = 0;
  await Promise.all(Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (next < values.length) {
        const index = next++;
        results[index] = await run(values[index]);
      }
    },
  ));
  return results;
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
