/// <reference lib="deno.worker" />

import type { EngineToHost, HostToEngine, RuntimeEvent } from "../protocol.ts";
import { WorkspaceRuntime } from "./runtime.ts";

let generation = 0;
let runtime: WorkspaceRuntime | undefined;

self.onmessage = async (message: MessageEvent<HostToEngine>) => {
  const envelope = message.data;
  if (envelope.type === "init") {
    generation = envelope.generation;
    try {
      runtime = await WorkspaceRuntime.create(
        generation,
        envelope.workspace,
        envelope.dataDir,
        envelope.model,
        publish,
      );
      send({ type: "ready", generation, snapshot: runtime.snapshot() });
    } catch (error) {
      publish({
        type: "notice",
        level: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (envelope.generation !== generation || !runtime) return;
  try {
    const value = await runtime.command(envelope.command);
    send({ type: "response", generation, requestId: envelope.requestId, ok: true, value });
  } catch (error) {
    send({
      type: "response",
      generation,
      requestId: envelope.requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

function publish(event: RuntimeEvent): void {
  send({ type: "event", generation, event });
}

function send(message: EngineToHost): void {
  self.postMessage(message);
}
