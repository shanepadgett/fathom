import { join } from "node:path";
import {
  Agent,
  type AgentEvent,
  type AgentMessage,
  type AgentTool,
} from "@earendil-works/pi-agent-core";
import {
  createModels,
  type Credential,
  type CredentialInfo,
  type CredentialStore,
  Type,
} from "@earendil-works/pi-ai";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import type {
  ApprovalRequest,
  EngineCommand,
  ExtensionSummary,
  RuntimeEvent,
  RuntimeSnapshot,
  StoredMessage,
} from "../protocol.ts";
import { SessionRepository } from "./database.ts";
import { type LoadedExtensions, loadExtensions } from "./extensions.ts";
import { resolveWorkspacePath } from "./paths.ts";

type Publish = (event: RuntimeEvent) => void;

export class WorkspaceRuntime {
  private readonly repository: SessionRepository;
  private readonly agent: Agent;
  private readonly publish: Publish;
  private extensions: LoadedExtensions;
  private selectedSessionId: string;
  private activeRunId?: string;
  private busy = false;
  private pendingReload = false;
  private watcher?: Deno.FsWatcher;
  private approval?: ApprovalRequest;
  private approvalResolver?: (approved: boolean) => void;
  private approvedWrites = new Set<string>();
  private messageRecords = new Map<string, StoredMessage>();

  private constructor(
    readonly generation: number,
    readonly workspace: string,
    readonly modelId: string,
    repository: SessionRepository,
    extensions: LoadedExtensions,
    agent: Agent,
    selectedSessionId: string,
    publish: Publish,
  ) {
    this.repository = repository;
    this.extensions = extensions;
    this.agent = agent;
    this.selectedSessionId = selectedSessionId;
    this.publish = publish;
    this.agent.subscribe((event) => this.onAgentEvent(event));
    this.watchExtensions();
  }

  static async create(
    generation: number,
    workspaceInput: string,
    dataDir: string,
    modelId: string,
    publish: Publish,
  ): Promise<WorkspaceRuntime> {
    const workspace = await Deno.realPath(workspaceInput);
    await Deno.mkdir(dataDir, { recursive: true, mode: 0o700 });
    const repository = new SessionRepository(join(dataDir, "fathom.sqlite"), workspace);
    let selectedSessionId = repository.listSessions()[0]?.id;
    if (!selectedSessionId) selectedSessionId = repository.createSession();

    const extensions = await loadExtensions(workspace, repository, generation);
    const credentials = new PiCredentialStore();
    const models = createModels({ credentials });
    models.setProvider(openaiCodexProvider());
    const model = models.getModel("openai-codex", modelId);
    if (!model) throw new Error(`OpenAI Codex model ${modelId} is unavailable in Pi 0.83.0`);

    const runtimeRef: { current?: WorkspaceRuntime } = {};
    const tools = [
      ...builtInTools(workspace, () => runtimeRef.current?.approvedWrites ?? new Set()),
      ...extensions.tools,
    ];
    const agent = new Agent({
      initialState: {
        systemPrompt:
          `You are Fathom, a coding assistant operating in ${workspace}. Use file tools when useful. Keep responses concise.`,
        model,
        thinkingLevel: "high",
        tools,
        messages: repository.loadMessages(selectedSessionId).map((entry) => entry.message),
      },
      streamFn: models.streamSimple.bind(models),
      transport: "sse",
      sessionId: selectedSessionId,
      transformContext: (messages) => Promise.resolve(messages),
      beforeToolCall: async (context, signal) => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        if (context.toolCall.name !== "write_file") return;
        const args = context.args as { path?: unknown };
        if (typeof args.path !== "string") return { block: true, reason: "Invalid write path" };
        const path = await resolveWorkspacePath(workspace, args.path, true);
        try {
          const info = await Deno.lstat(path);
          if (!info.isFile || info.isSymlink) {
            return { block: true, reason: "Target is not a regular file" };
          }
        } catch (error) {
          if (error instanceof Deno.errors.NotFound) return;
          throw error;
        }
        const approved = await runtime.requestApproval({
          id: crypto.randomUUID(),
          toolCallId: context.toolCall.id,
          toolName: context.toolCall.name,
          title: "Overwrite file?",
          detail: args.path,
        }, signal);
        if (!approved) return { block: true, reason: "User rejected file overwrite" };
        runtime.approvedWrites.add(context.toolCall.id);
      },
    });
    const runtime = new WorkspaceRuntime(
      generation,
      workspace,
      modelId,
      repository,
      extensions,
      agent,
      selectedSessionId,
      publish,
    );
    runtimeRef.current = runtime;
    return runtime;
  }

  snapshot(): RuntimeSnapshot {
    return {
      generation: this.generation,
      workspace: this.workspace,
      model: this.modelId,
      busy: this.busy,
      pendingReload: this.pendingReload,
      selectedSessionId: this.selectedSessionId,
      sessions: this.repository.listSessions(),
      messages: this.repository.loadMessages(this.selectedSessionId),
      extensions: this.extensionSummaries(),
      commands: [
        { name: "reload", description: "Reload enabled backend and renderer extensions" },
        ...this.extensions.commands.map(({ name, description }) => ({ name, description })),
      ],
      approval: this.approval,
    };
  }

  async command(command: EngineCommand): Promise<unknown> {
    switch (command.type) {
      case "prompt":
        if (this.busy) throw new Error("Agent is already running");
        if (!command.text.trim()) throw new Error("Prompt is empty");
        this.busy = true;
        this.publishSnapshot();
        void this.runPrompt(command.text.trim());
        return { accepted: true };
      case "abort":
        this.agent.abort();
        return { accepted: true };
      case "create_session":
        this.assertIdle();
        this.selectedSessionId = this.repository.createSession();
        this.hydrateSelectedSession();
        this.publishSnapshot();
        return this.selectedSessionId;
      case "select_session":
        this.assertIdle();
        if (!this.repository.listSessions().some((session) => session.id === command.sessionId)) {
          throw new Error("Session does not exist");
        }
        this.selectedSessionId = command.sessionId;
        this.hydrateSelectedSession();
        this.publishSnapshot();
        return undefined;
      case "toggle_extension":
        this.assertIdle();
        if (!this.extensions.summaries.some((entry) => entry.id === command.extensionId)) {
          throw new Error("Extension does not exist");
        }
        this.repository.setExtensionEnabled(command.extensionId, command.enabled);
        this.pendingReload = true;
        this.publishSnapshot();
        return undefined;
      case "run_command": {
        this.assertIdle();
        const extensionCommand = this.extensions.commands.find((entry) =>
          entry.name === command.name
        );
        if (!extensionCommand) throw new Error(`Unknown command /${command.name}`);
        const result = await extensionCommand.run(command.arguments);
        this.publish({ type: "notice", level: "info", message: result });
        return result;
      }
      case "resolve_approval":
        if (!this.approval || command.approvalId !== this.approval.id || !this.approvalResolver) {
          throw new Error("Approval is no longer pending");
        }
        this.approvalResolver(command.approved);
        return undefined;
      case "prepare_reload":
        this.assertIdle();
        await this.close();
        return { ready: true };
    }
  }

  private async runPrompt(text: string): Promise<void> {
    const runId = this.repository.startRun(this.selectedSessionId);
    this.activeRunId = runId;
    this.messageRecords.clear();
    this.repository.renameFromPrompt(this.selectedSessionId, text);
    try {
      await this.agent.prompt(text);
      const last = this.agent.state.messages.at(-1);
      const stopReason = last && "role" in last && last.role === "assistant"
        ? last.stopReason
        : undefined;
      this.repository.finishRun(
        runId,
        stopReason === "aborted" ? "aborted" : stopReason === "error" ? "error" : "complete",
      );
    } catch (error) {
      this.repository.finishRun(runId, this.agent.signal?.aborted ? "aborted" : "error");
      this.publish({
        type: "notice",
        level: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.activeRunId = undefined;
      this.busy = false;
      this.approvedWrites.clear();
      this.publishSnapshot();
    }
  }

  private onAgentEvent(event: AgentEvent): void {
    const runId = this.activeRunId;
    if (!runId) return;
    this.repository.appendEvent(this.selectedSessionId, runId, event.type, event);
    if (event.type === "message_start") {
      const record = this.repository.startMessage(this.selectedSessionId, runId, event.message);
      this.messageRecords.set(messageKey(event.message), record);
      this.publish({ type: "message_started", record });
    } else if (event.type === "message_update") {
      const key = messageKey(event.message);
      const current = this.messageRecords.get(key);
      if (current) {
        const record = this.repository.updateMessage(current, event.message);
        this.messageRecords.set(key, record);
        this.publish({ type: "message_updated", record });
      }
    } else if (event.type === "message_end") {
      const key = messageKey(event.message);
      const current = this.messageRecords.get(key);
      if (current) {
        const record = this.repository.updateMessage(current, event.message, true);
        this.messageRecords.set(key, record);
        this.publish({ type: "message_finished", record });
      }
    } else if (event.type === "tool_execution_start") {
      this.publish({
        type: "tool_started",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      });
    } else if (event.type === "tool_execution_update") {
      this.publish({
        type: "tool_updated",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.partialResult,
      });
    } else if (event.type === "tool_execution_end") {
      this.publish({
        type: "tool_finished",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
        isError: event.isError,
      });
    }
  }

  private requestApproval(approval: ApprovalRequest, signal?: AbortSignal): Promise<boolean> {
    if (this.approval) return Promise.resolve(false);
    this.approval = approval;
    this.publish({ type: "approval_required", approval });
    this.publishSnapshot();
    return new Promise((resolve) => {
      const settle = (approved: boolean) => {
        signal?.removeEventListener("abort", abort);
        this.approval = undefined;
        this.approvalResolver = undefined;
        this.publish({ type: "approval_resolved", approvalId: approval.id });
        this.publishSnapshot();
        resolve(approved);
      };
      const abort = () => settle(false);
      this.approvalResolver = settle;
      signal?.addEventListener("abort", abort, { once: true });
    });
  }

  private hydrateSelectedSession(): void {
    this.agent.state.messages = this.repository.loadMessages(this.selectedSessionId).map((entry) =>
      entry.message
    );
    this.agent.sessionId = this.selectedSessionId;
  }

  private extensionSummaries(): ExtensionSummary[] {
    return this.extensions.summaries.map((summary) => ({
      ...summary,
      enabled: this.repository.extensionEnabled(summary.id) ?? true,
    }));
  }

  private publishSnapshot(): void {
    this.publish({ type: "snapshot", snapshot: this.snapshot() });
  }

  private assertIdle(): void {
    if (this.busy) throw new Error("Wait for the active run to finish");
  }

  private watchExtensions(): void {
    const root = join(this.workspace, ".fathom", "extensions");
    try {
      this.watcher = Deno.watchFs(root, { recursive: true });
      void (async () => {
        for await (const event of this.watcher!) {
          if (event.kind === "access") continue;
          this.pendingReload = true;
          this.publishSnapshot();
        }
      })();
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        this.publish({ type: "notice", level: "error", message: `Extension watcher: ${error}` });
      }
    }
  }

  private async close(): Promise<void> {
    this.watcher?.close();
    if (this.approvalResolver) this.approvalResolver(false);
    await this.extensions.dispose();
    this.repository.close();
  }
}

function builtInTools(workspace: string, approvedWrites: () => Set<string>): AgentTool[] {
  const readFile: AgentTool = {
    name: "read_file",
    label: "Read file",
    description: "Read a UTF-8 text file inside the selected workspace.",
    parameters: Type.Object({ path: Type.String({ description: "Workspace-relative file path" }) }),
    async execute(_toolCallId, params) {
      const input = params as { path: string };
      const path = await resolveWorkspacePath(workspace, input.path);
      const info = await Deno.lstat(path);
      if (!info.isFile || info.isSymlink) throw new Error("Target is not a regular file");
      if (info.size > 1_000_000) throw new Error("Prototype read limit is 1 MB");
      const text = await Deno.readTextFile(path);
      return {
        content: [{ type: "text", text }],
        details: { path: input.path, bytes: info.size },
      };
    },
  };

  const writeFile: AgentTool = {
    name: "write_file",
    label: "Write file",
    description:
      "Create or completely overwrite one UTF-8 text file inside the selected workspace.",
    parameters: Type.Object({
      path: Type.String({ description: "Workspace-relative file path" }),
      content: Type.String({ description: "Complete replacement file contents" }),
    }),
    executionMode: "sequential",
    async execute(toolCallId, params) {
      const input = params as { path: string; content: string };
      const path = await resolveWorkspacePath(workspace, input.path, true);
      let created = true;
      try {
        const info = await Deno.lstat(path);
        if (!info.isFile || info.isSymlink) throw new Error("Target is not a regular file");
        created = false;
        if (!approvedWrites().has(toolCallId)) throw new Error("Overwrite was not approved");
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
      }
      const content = input.content;
      if (new TextEncoder().encode(content).byteLength > 1_000_000) {
        throw new Error("Prototype write limit is 1 MB");
      }
      await Deno.writeTextFile(path, content, { create: true });
      approvedWrites().delete(toolCallId);
      return {
        content: [{ type: "text", text: `${created ? "Created" : "Overwrote"} ${input.path}` }],
        details: {
          path: input.path,
          bytes: new TextEncoder().encode(content).byteLength,
          created,
        },
      };
    },
  };
  return [readFile, writeFile];
}

function messageKey(message: AgentMessage): string {
  if (!("role" in message)) return JSON.stringify(message);
  const extra = message.role === "toolResult"
    ? message.toolCallId
    : "timestamp" in message
    ? message.timestamp
    : "";
  return `${message.role}:${extra}`;
}

class PiCredentialStore implements CredentialStore {
  private credentialPath(): string {
    const home = Deno.env.get("HOME");
    if (!home) throw new Error("HOME is unavailable");
    return join(home, ".pi", "agent", "auth.json");
  }

  async read(providerId: string): Promise<Credential | undefined> {
    if (providerId !== "openai-codex") return undefined;
    const path = this.credentialPath();
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
    return Promise.reject(
      new Error(
        "Fathom prototype will not refresh or modify Pi credentials; refresh them through Pi",
      ),
    );
  }

  delete(): Promise<void> {
    return Promise.reject(new Error("Fathom prototype will not modify Pi credentials"));
  }
}
