import type { Context as PiContext, ToolCall } from "@earendil-works/pi-ai";
import {
  Context,
  Data,
  Effect,
  Layer,
  ManagedRuntime,
  Queue,
  Schedule,
  Stream,
  Take,
} from "effect";
import {
  defaultPolicy,
  type Dependencies,
  initialContext,
  isTransient,
  type RuntimeEvent,
  type RuntimePolicy,
  type RuntimeRecord,
  toolResult,
} from "../shared.ts";

export class RuntimeFailure extends Data.TaggedError("RuntimeFailure")<{
  area: "model" | "approval" | "tool" | "persistence";
  cause: unknown;
  retryable?: boolean;
}> {}

class RuntimeServices extends Context.Tag("RuntimeServices")<RuntimeServices, Dependencies>() {}

export function makeEffectRuntime(
  dependencies: Dependencies,
  policy: RuntimePolicy = defaultPolicy,
) {
  const runtime = ManagedRuntime.make(Layer.succeed(RuntimeServices, dependencies));
  return {
    run(
      prompt: string,
      emit: (event: RuntimeEvent) => void | Promise<void>,
      signal?: AbortSignal,
    ) {
      return runtime.runPromise(
        runEvents(prompt, policy).pipe(
          Stream.runForEach((event) => Effect.promise(() => Promise.resolve(emit(event)))),
        ),
        { signal },
      );
    },
    dispose: () => runtime.dispose(),
  };
}

export const runEvents = (prompt: string, policy: RuntimePolicy = defaultPolicy) =>
  Stream.unwrapScoped(Effect.gen(function* () {
    const dependencies = yield* RuntimeServices;
    const queue = yield* Queue.bounded<Take.Take<RuntimeEvent, RuntimeFailure>>(64);
    const publish = (event: RuntimeEvent) => Queue.offer(queue, Take.of(event));
    yield* runEffect(prompt, dependencies, policy, publish).pipe(
      Effect.matchCauseEffect({
        onFailure: (cause) => Queue.offer(queue, Take.failCause(cause)),
        onSuccess: () => Queue.offer(queue, Take.end),
      }),
      Effect.forkScoped,
    );
    return Stream.fromQueue(queue).pipe(Stream.flattenTake);
  }));

function runEffect(
  prompt: string,
  dependencies: Dependencies,
  policy: RuntimePolicy,
  publish: (event: RuntimeEvent) => Effect.Effect<unknown>,
) {
  return Effect.acquireUseRelease(
    Effect.void,
    () => agentLoop(prompt, dependencies, policy, publish),
    () =>
      Effect.promise(dependencies.disposeExtension).pipe(
        Effect.andThen(publish({ type: "extension_disposed", extensionId: "workspace" })),
      ),
  );
}

function agentLoop(
  prompt: string,
  dependencies: Dependencies,
  policy: RuntimePolicy,
  publish: (event: RuntimeEvent) => Effect.Effect<unknown>,
) {
  return Effect.gen(function* () {
    const runId = crypto.randomUUID();
    const context = initialContext(prompt);
    yield* publish({ type: "run_started", runId });
    yield* persist(dependencies, { runId, kind: "user", value: context.messages[0] });

    while (true) {
      const assistant = yield* modelTurn(dependencies, publish, context).pipe(
        Effect.timeoutFail({
          duration: policy.modelTimeoutMs,
          onTimeout: () => new RuntimeFailure({ area: "model", cause: "Model timed out" }),
        }),
        Effect.retry({
          schedule: Schedule.spaced(policy.retryDelayMs).pipe(
            Schedule.intersect(Schedule.recurs(policy.modelAttempts - 1)),
          ),
          while: (failure) => failure.retryable === true,
        }),
      );
      context.messages.push(assistant);
      yield* persist(dependencies, { runId, kind: "assistant", value: assistant });

      const calls = assistant.content.filter((part): part is ToolCall => part.type === "toolCall");
      if (calls.length === 0) break;
      for (const call of calls) {
        yield* publish({
          type: "approval_requested",
          toolCallId: call.id,
          toolName: call.name,
        });
      }
      const approvals = yield* Effect.forEach(
        calls,
        (call) => approve(dependencies, call, policy.toolTimeoutMs),
        { concurrency: policy.toolConcurrency },
      );
      for (let index = 0; index < calls.length; index++) {
        yield* publish({
          type: "approval_resolved",
          toolCallId: calls[index].id,
          approved: approvals[index],
        });
        if (!approvals[index]) {
          return yield* new RuntimeFailure({ area: "approval", cause: "Approval denied" });
        }
      }
      const outputs = yield* Effect.forEach(
        calls,
        (call) => executeTool(dependencies, call, policy.toolTimeoutMs),
        { concurrency: policy.toolConcurrency },
      );
      for (let index = 0; index < calls.length; index++) {
        const call = calls[index];
        const output = outputs[index];
        const result = toolResult(call, output);
        context.messages.push(result);
        yield* persist(dependencies, { runId, kind: "tool", value: result });
        yield* publish({ type: "tool_finished", toolCallId: call.id, output });
      }
    }
    yield* publish({ type: "run_finished", runId });
  });
}

function modelTurn(
  dependencies: Dependencies,
  publish: (event: RuntimeEvent) => Effect.Effect<unknown>,
  context: PiContext,
) {
  return Effect.suspend(() => {
    let emitted = false;
    return Effect.scoped(Effect.gen(function* () {
      const controller = yield* Effect.acquireRelease(
        Effect.sync(() => new AbortController()),
        (controller) => Effect.sync(() => controller.abort()),
      );
      const response = yield* Effect.try({
        try: () => dependencies.stream(context, controller.signal),
        catch: (cause) =>
          new RuntimeFailure({ area: "model", cause, retryable: isTransient(cause) }),
      });
      yield* Stream.fromAsyncIterable(
        response,
        (cause) =>
          new RuntimeFailure({ area: "model", cause, retryable: !emitted && isTransient(cause) }),
      ).pipe(
        Stream.runForEach((event) =>
          event.type === "text_delta"
            ? Effect.sync(() => {
              emitted = true;
            }).pipe(Effect.andThen(publish({ type: "text_delta", delta: event.delta })))
            : Effect.void
        ),
      );
      return yield* Effect.tryPromise({
        try: () => response.result(),
        catch: (cause) =>
          new RuntimeFailure({ area: "model", cause, retryable: !emitted && isTransient(cause) }),
      });
    }));
  });
}

function approve(dependencies: Dependencies, call: ToolCall, timeoutMs: number) {
  return Effect.tryPromise({
    try: (signal) => dependencies.approve(call.id, call.name, signal),
    catch: (cause) => new RuntimeFailure({ area: "approval", cause }),
  }).pipe(Effect.timeoutFail({
    duration: timeoutMs,
    onTimeout: () => new RuntimeFailure({ area: "approval", cause: "Approval timed out" }),
  }));
}

function executeTool(dependencies: Dependencies, call: ToolCall, timeoutMs: number) {
  const path = call.arguments.path;
  if (call.name !== "inspect_workspace" || typeof path !== "string") {
    return Effect.fail(new RuntimeFailure({ area: "tool", cause: "Invalid tool call" }));
  }
  return Effect.tryPromise({
    try: (signal) => dependencies.inspectWorkspace(path, signal),
    catch: (cause) => new RuntimeFailure({ area: "tool", cause }),
  }).pipe(Effect.timeoutFail({
    duration: timeoutMs,
    onTimeout: () => new RuntimeFailure({ area: "tool", cause: "Tool timed out" }),
  }));
}

function persist(dependencies: Dependencies, record: RuntimeRecord) {
  return Effect.tryPromise({
    try: () => dependencies.persist(record),
    catch: (cause) => new RuntimeFailure({ area: "persistence", cause }),
  });
}
