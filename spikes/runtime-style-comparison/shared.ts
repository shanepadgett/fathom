import { join } from "node:path";
import {
  type Api,
  type AssistantMessage,
  type AssistantMessageEvent,
  type Context,
  createModels,
  type Credential,
  type CredentialInfo,
  type CredentialStore,
  type Message,
  type Model,
  Type,
} from "@earendil-works/pi-ai";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";

export type RuntimeEvent =
  | { type: "run_started"; runId: string }
  | { type: "text_delta"; delta: string }
  | { type: "approval_requested"; toolCallId: string; toolName: string }
  | { type: "approval_resolved"; toolCallId: string; approved: boolean }
  | { type: "tool_finished"; toolCallId: string; output: string }
  | { type: "run_finished"; runId: string }
  | { type: "extension_disposed"; extensionId: string };

export interface RuntimeRecord {
  runId: string;
  kind: "user" | "assistant" | "tool";
  value: unknown;
}

export interface RuntimePolicy {
  modelAttempts: number;
  retryDelayMs: number;
  modelTimeoutMs: number;
  toolTimeoutMs: number;
  toolConcurrency: number;
}

export const defaultPolicy: RuntimePolicy = {
  modelAttempts: 3,
  retryDelayMs: 100,
  modelTimeoutMs: 60_000,
  toolTimeoutMs: 30_000,
  toolConcurrency: 4,
};

export class TransientError extends Error {}

export function isTransient(cause: unknown): boolean {
  if (cause instanceof TransientError) return true;
  if (!cause || typeof cause !== "object") return false;
  const status = "status" in cause ? cause.status : undefined;
  return status === 408 || status === 409 || status === 429 ||
    (typeof status === "number" && status >= 500);
}

export interface Dependencies {
  model: Model<Api>;
  stream(context: Context, signal: AbortSignal): AsyncIterable<AssistantMessageEvent> & {
    result(): Promise<AssistantMessage>;
  };
  approve(toolCallId: string, toolName: string, signal: AbortSignal): Promise<boolean>;
  persist(record: RuntimeRecord): Promise<void>;
  inspectWorkspace(path: string, signal: AbortSignal): Promise<string>;
  disposeExtension(): Promise<void>;
}

export const inspectTool = {
  name: "inspect_workspace",
  description: "Read a UTF-8 text file in the current workspace.",
  parameters: Type.Object({ path: Type.String() }),
};

export function initialContext(prompt: string): Context {
  return {
    systemPrompt:
      "You are a concise coding assistant. You must call inspect_workspace for the requested file before answering.",
    messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
    tools: [inspectTool],
  };
}

export function toolResult(call: { id: string; name: string }, output: string): Message {
  return {
    role: "toolResult",
    toolCallId: call.id,
    toolName: call.name,
    content: [{ type: "text", text: output }],
    isError: false,
    timestamp: Date.now(),
  };
}

export function liveDependencies(workspace: string): Dependencies {
  const models = createModels({ credentials: new PiCredentialStore() });
  models.setProvider(openaiCodexProvider());
  const modelId = Deno.env.get("FATHOM_MODEL") ?? "gpt-5.6-sol";
  const model = models.getModel("openai-codex", modelId);
  if (!model) throw new Error(`OpenAI Codex model ${modelId} is unavailable`);
  const logPath = join(workspace, ".runtime-style-comparison.jsonl");

  return {
    model,
    stream: (context, signal) =>
      models.streamSimple(model, context, {
        reasoning: "medium",
        signal,
        transport: "sse",
      }),
    async approve(_toolCallId, _toolName, signal) {
      await abortableDelay(50, signal);
      return true;
    },
    async persist(record) {
      await Deno.writeTextFile(logPath, `${JSON.stringify(record)}\n`, {
        append: true,
        create: true,
      });
    },
    async inspectWorkspace(path, signal) {
      if (signal.aborted) throw signal.reason;
      if (path.includes("..") || path.startsWith("/")) throw new Error("Path leaves workspace");
      return await Deno.readTextFile(join(workspace, path));
    },
    disposeExtension: () => Promise.resolve(),
  };
}

export function eventLine(event: RuntimeEvent): string {
  if (event.type === "text_delta") return event.delta;
  return `\n[${event.type}]\n`;
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

class PiCredentialStore implements CredentialStore {
  async read(providerId: string): Promise<Credential | undefined> {
    if (providerId !== "openai-codex") return undefined;
    const home = Deno.env.get("HOME");
    if (!home) throw new Error("HOME is unavailable");
    const path = join(home, ".pi", "agent", "auth.json");
    const info = await Deno.lstat(path);
    if (!info.isFile || info.isSymlink || (info.mode !== null && (info.mode & 0o077) !== 0)) {
      throw new Error("Pi credential file is not a private regular file");
    }
    const parsed = JSON.parse(await Deno.readTextFile(path)) as Record<string, unknown>;
    const value = parsed[providerId] as Record<string, unknown> | undefined;
    if (
      !value || value.type !== "oauth" || typeof value.access !== "string" ||
      typeof value.refresh !== "string" || typeof value.expires !== "number"
    ) throw new Error("OpenAI Codex OAuth credentials are missing; log in through Pi");
    return value as Credential;
  }

  async list(): Promise<readonly CredentialInfo[]> {
    return (await this.read("openai-codex")) ? [{ providerId: "openai-codex", type: "oauth" }] : [];
  }

  modify(): Promise<Credential | undefined> {
    return Promise.reject(new Error("Spike will not modify Pi credentials"));
  }

  delete(): Promise<void> {
    return Promise.reject(new Error("Spike will not modify Pi credentials"));
  }
}
