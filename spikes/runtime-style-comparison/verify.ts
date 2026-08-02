import type { AssistantMessage, AssistantMessageEvent } from "@earendil-works/pi-ai";
import { makeEffectRuntime } from "./effect/runtime.ts";
import { runPlain } from "./plain/runtime.ts";
import {
  defaultPolicy,
  type Dependencies,
  type RuntimeEvent,
  type RuntimeRecord,
  TransientError,
} from "./shared.ts";

for (const style of ["plain", "effect"] as const) {
  const events: RuntimeEvent[] = [];
  const records: RuntimeRecord[] = [];
  let call = 0;
  let disposed = false;
  let activeTools = 0;
  let maxActiveTools = 0;
  const dependencies: Dependencies = {
    model: fakeModel(),
    stream: (_context, _signal) => {
      const message = call++ === 0 ? toolCallMessage() : answerMessage();
      return fakeResponse(message);
    },
    approve: () => Promise.resolve(true),
    persist: (record) => {
      records.push(record);
      return Promise.resolve();
    },
    inspectWorkspace: async (path) => {
      activeTools++;
      maxActiveTools = Math.max(maxActiveTools, activeTools);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeTools--;
      return `fixture contents: ${path}`;
    },
    disposeExtension: () => {
      disposed = true;
      return Promise.resolve();
    },
  };

  if (style === "plain") {
    for await (
      const event of runPlain("inspect README.md", dependencies, AbortSignal.timeout(1000))
    ) {
      events.push(event);
    }
  } else {
    const runtime = makeEffectRuntime(dependencies);
    try {
      await runtime.run("inspect README.md", (event) => {
        events.push(event);
      });
    } finally {
      await runtime.dispose();
    }
  }

  if (!disposed) throw new Error(`${style}: extension was not disposed`);
  if (call !== 2) throw new Error(`${style}: expected two model calls, got ${call}`);
  if (records.map((record) => record.kind).join(",") !== "user,assistant,tool,tool,assistant") {
    throw new Error(`${style}: persistence order is wrong`);
  }
  if (!events.some((event) => event.type === "approval_requested")) {
    throw new Error(`${style}: approval was not requested`);
  }
  if (
    events.filter((event) => event.type === "text_delta").map((event) => event.delta).join("") !==
      "Fixture summary."
  ) throw new Error(`${style}: live text deltas are wrong`);
  if (maxActiveTools !== 2) throw new Error(`${style}: tool calls did not run concurrently`);
  if (events.at(-1)?.type !== "extension_disposed") {
    throw new Error(`${style}: cleanup event is not last`);
  }
}

console.log("plain and Effect runtimes passed the same deterministic scenario");

for (const style of ["plain", "effect"] as const) {
  const controller = new AbortController();
  let disposed = false;
  const dependencies: Dependencies = {
    model: fakeModel(),
    stream: () => fakeResponse(toolCallMessage()),
    approve: () => Promise.resolve(true),
    persist: () => Promise.resolve(),
    inspectWorkspace: (_path, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        queueMicrotask(() => controller.abort(new Error("host cancelled")));
      }),
    disposeExtension: () => {
      disposed = true;
      return Promise.resolve();
    },
  };

  try {
    if (style === "plain") {
      for await (const _event of runPlain("cancel", dependencies, controller.signal)) {
        // consume until cancellation
      }
    } else {
      const runtime = makeEffectRuntime(dependencies);
      try {
        await runtime.run("cancel", () => {}, controller.signal);
      } finally {
        await runtime.dispose();
      }
    }
    throw new Error(`${style}: cancellation unexpectedly succeeded`);
  } catch {
    if (!controller.signal.aborted) throw new Error(`${style}: cancellation was not propagated`);
  }
  if (!disposed) throw new Error(`${style}: cancellation skipped extension cleanup`);
}

console.log("plain and Effect runtimes propagated host cancellation and cleaned up");

for (const style of ["plain", "effect"] as const) {
  let attempts = 0;
  let disposed = false;
  const dependencies: Dependencies = {
    model: fakeModel(),
    stream: () => {
      if (attempts++ === 0) throw new TransientError("temporary model failure");
      return fakeResponse(answerMessage());
    },
    approve: () => Promise.resolve(true),
    persist: () => Promise.resolve(),
    inspectWorkspace: () => Promise.resolve("unused"),
    disposeExtension: () => {
      disposed = true;
      return Promise.resolve();
    },
  };
  const policy = { ...defaultPolicy, retryDelayMs: 1 };
  if (style === "plain") {
    for await (
      const _event of runPlain("retry", dependencies, new AbortController().signal, policy)
    ) {
      // consume run
    }
  } else {
    const runtime = makeEffectRuntime(dependencies, policy);
    try {
      await runtime.run("retry", () => {});
    } finally {
      await runtime.dispose();
    }
  }
  if (attempts !== 2) throw new Error(`${style}: transient model failure was not retried once`);
  if (!disposed) throw new Error(`${style}: retry run skipped cleanup`);
}

console.log("plain and Effect runtimes retried transient model failures");

for (const style of ["plain", "effect"] as const) {
  let disposed = false;
  const dependencies: Dependencies = {
    model: fakeModel(),
    stream: () => fakeResponse(toolCallMessage()),
    approve: () => Promise.resolve(true),
    persist: () => Promise.resolve(),
    inspectWorkspace: (_path, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    disposeExtension: () => {
      disposed = true;
      return Promise.resolve();
    },
  };
  const policy = { ...defaultPolicy, toolTimeoutMs: 5 };
  try {
    if (style === "plain") {
      for await (
        const _event of runPlain("timeout", dependencies, new AbortController().signal, policy)
      ) {
        // consume until timeout
      }
    } else {
      const runtime = makeEffectRuntime(dependencies, policy);
      try {
        await runtime.run("timeout", () => {});
      } finally {
        await runtime.dispose();
      }
    }
    throw new Error(`${style}: tool timeout unexpectedly succeeded`);
  } catch {
    // expected timeout
  }
  if (!disposed) throw new Error(`${style}: timeout skipped cleanup`);
}

console.log("plain and Effect runtimes timed out tools and cleaned up");

for (const style of ["plain", "effect"] as const) {
  let persisted = 0;
  let toolCalls = 0;
  let disposed = false;
  const dependencies: Dependencies = {
    model: fakeModel(),
    stream: () => fakeResponse(toolCallMessage()),
    approve: () => Promise.resolve(true),
    persist: () => {
      if (++persisted === 2) return Promise.reject(new Error("SQLite commit failed"));
      return Promise.resolve();
    },
    inspectWorkspace: () => {
      toolCalls++;
      return Promise.resolve("must not run");
    },
    disposeExtension: () => {
      disposed = true;
      return Promise.resolve();
    },
  };
  try {
    if (style === "plain") {
      for await (
        const _event of runPlain("persistence failure", dependencies, new AbortController().signal)
      ) {
        // consume until persistence fails
      }
    } else {
      const runtime = makeEffectRuntime(dependencies);
      try {
        await runtime.run("persistence failure", () => {});
      } finally {
        await runtime.dispose();
      }
    }
    throw new Error(`${style}: persistence failure unexpectedly succeeded`);
  } catch {
    // expected persistence failure
  }
  if (toolCalls !== 0) throw new Error(`${style}: continued after persistence failure`);
  if (!disposed) throw new Error(`${style}: persistence failure skipped cleanup`);
}

console.log("plain and Effect runtimes stopped on persistence failure and cleaned up");

for (const style of ["plain", "effect"] as const) {
  let attempts = 0;
  let disposed = false;
  const dependencies: Dependencies = {
    model: fakeModel(),
    stream: () => {
      attempts++;
      return partialThenFailResponse();
    },
    approve: () => Promise.resolve(true),
    persist: () => Promise.resolve(),
    inspectWorkspace: () => Promise.resolve("unused"),
    disposeExtension: () => {
      disposed = true;
      return Promise.resolve();
    },
  };
  try {
    if (style === "plain") {
      for await (
        const _event of runPlain("partial failure", dependencies, new AbortController().signal)
      ) {
        // consume partial output, then failure
      }
    } else {
      const runtime = makeEffectRuntime(dependencies);
      try {
        await runtime.run("partial failure", () => {});
      } finally {
        await runtime.dispose();
      }
    }
    throw new Error(`${style}: partial stream failure unexpectedly succeeded`);
  } catch {
    // expected model failure
  }
  if (attempts !== 1) throw new Error(`${style}: retried after publishing partial output`);
  if (!disposed) throw new Error(`${style}: partial stream failure skipped cleanup`);
}

console.log("plain and Effect runtimes did not replay partially published model output");

function fakeResponse(message: AssistantMessage) {
  return {
    async *[Symbol.asyncIterator](): AsyncGenerator<AssistantMessageEvent> {
      yield { type: "start", partial: message };
      for (const part of message.content) {
        if (part.type === "text") {
          yield {
            type: "text_delta",
            contentIndex: 0,
            delta: part.text,
            partial: message,
          } as const;
        }
      }
      if (
        message.stopReason !== "stop" && message.stopReason !== "length" &&
        message.stopReason !== "toolUse"
      ) throw new Error("fixture has invalid stop reason");
      yield { type: "done", reason: message.stopReason, message };
    },
    result: () => Promise.resolve(message),
  };
}

function partialThenFailResponse() {
  const message = answerMessage();
  return {
    async *[Symbol.asyncIterator](): AsyncGenerator<AssistantMessageEvent> {
      yield { type: "text_delta", contentIndex: 0, delta: "partial", partial: message };
      throw new TransientError("stream disconnected");
    },
    result: () => Promise.reject<AssistantMessage>(new TransientError("stream disconnected")),
  };
}

function fakeModel() {
  return {
    id: "fake",
    name: "Fake",
    api: "openai-responses",
    provider: "fake",
    baseUrl: "https://invalid.example",
    reasoning: false,
    input: ["text" as const],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1000,
    maxTokens: 100,
  };
}

function toolCallMessage(): AssistantMessage {
  return message([
    {
      type: "toolCall",
      id: "call-1",
      name: "inspect_workspace",
      arguments: { path: "README.md" },
    },
    {
      type: "toolCall",
      id: "call-2",
      name: "inspect_workspace",
      arguments: { path: "deno.json" },
    },
  ], "toolUse");
}

function answerMessage(): AssistantMessage {
  return message([{ type: "text", text: "Fixture summary." }], "stop");
}

function message(
  content: AssistantMessage["content"],
  stopReason: AssistantMessage["stopReason"],
): AssistantMessage {
  return {
    role: "assistant",
    content,
    api: "openai-responses",
    provider: "fake",
    model: "fake",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason,
    timestamp: Date.now(),
  };
}
