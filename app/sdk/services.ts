import type {
  Api,
  AssistantMessage,
  Context as ModelContext,
  Message,
  Model,
  MutableModels,
  SimpleStreamOptions,
  TSchema,
} from "@earendil-works/pi-ai";

import type { ArtifactService } from "./artifacts.ts";
import type { LspService } from "./editor.ts";
import type { FeedbackService } from "./feedback.ts";
import type { ImageGenerationService } from "./images.ts";
import type { MediaService } from "./media.ts";
import type { ResourceService } from "./resources.ts";
import type {
  AppEvent,
  Attribution,
  Entry,
  EntryAttachment,
  Session,
  SessionState,
  ToolExecution,
  UsageRecord,
} from "./session.ts";

export interface StorageService {
  listSessions(): Session[];
  createSession(
    input?: Partial<Pick<Session, "title" | "provider" | "model" | "parentSessionId" | "thinking">>,
  ): Session;
  getSession(id: string): Session;
  updateSession(id: string, changes: Partial<Omit<Session, "id" | "createdAt">>): Session;
  entries(sessionId: string, leafId?: string | null): Entry[];
  allEntries(sessionId: string): Entry[];
  append(
    sessionId: string,
    input: Omit<Entry, "id" | "sessionId" | "parentId" | "createdAt">,
  ): Entry;
  updateEntry(
    id: string,
    input: Partial<Pick<Entry, "message" | "status" | "snapshotTreeId">>,
  ): void;
  saveExecution(execution: ToolExecution): void;
  executions(sessionId: string): ToolExecution[];
  recordUsage(record: UsageRecord): void;
  usage(): UsageRecord[];
  setting<T>(key: string, fallback: T): T;
  setSetting(key: string, value: unknown): void;
  transaction<T>(action: () => T): T;
}

export interface WorkspaceService {
  id: string;
  root: string;
  dataDir: string;
  trusted(): boolean;
  resolve(path: string, write?: boolean): Promise<string>;
}

export interface ToolContext {
  sessionId: string;
  callId: string;
  signal: AbortSignal;
  report(text: string): void;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: TSchema;
  readOnly?: boolean;
  deferred?: boolean;
  /** Synchronous capability gate, applied to discovery and execution. */
  available?(sessionId: string): boolean;
  tags?: string[];
  execute(args: Record<string, unknown>, context: ToolContext): Promise<string>;
}

export interface ToolRegistry {
  register(tool: ToolDefinition): () => void;
  get(name: string): ToolDefinition | undefined;
  list(sessionId: string, includeDeferred?: boolean): ToolDefinition[];
  search(sessionId: string, query: string): ToolDefinition[];
}

export interface ContextService {
  assemble(sessionId: string): Promise<ModelContext>;
  registerPromptSection(id: string, text: string): () => void;
  registerProjector(type: string, project: (data: unknown) => Message | null): () => void;
}

export interface ModelService {
  models: MutableModels;
  select(sessionId?: string): Promise<Model<Api>>;
  complete(
    input: ModelContext & {
      attribution: Attribution;
      model?: Model<Api>;
      options?: SimpleStreamOptions;
      schema?: TSchema;
    },
  ): Promise<AssistantMessage>;
}

export interface RuntimeService {
  /** Edit a waiting message; null removes it. Rejects once consumed. */
  updateQueued(sessionId: string, id: string, text: string | null): void;
  sendQueued(sessionId: string, id: string): Promise<void>;
  submit(
    sessionId: string,
    text: string,
    mode?: "steer" | "follow_up",
    attachments?: EntryAttachment[],
  ): Promise<void>;
  resume(sessionId: string): Promise<void>;
  abort(sessionId: string): void;
  whenIdle(sessionId: string): Promise<void>;
  state(sessionId: string): SessionState;
}

export interface CompactionService {
  compact(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<{ summary: string; messagesCompacted: number; estimatedTokensSaved: number }>;
}

export interface ApprovalService {
  request(
    input: {
      sessionId: string;
      callId: string;
      name: string;
      args: Record<string, unknown>;
      signal: AbortSignal;
    },
    reason?: string,
  ): Promise<void>;
  resolve(id: string, approved: boolean): void;
  list(): {
    id: string;
    sessionId: string;
    explanation: string;
    name: string;
    args: Record<string, unknown>;
  }[];
}

export interface Services {
  devServers: import("./dev-servers.ts").DevServerService;
  terminal: import("./terminal.ts").TerminalService;
  lsp: LspService;
  feedback: FeedbackService;
  artifacts: ArtifactService;

  resources: ResourceService;
  images: ImageGenerationService;
  media: MediaService;
  compaction: CompactionService;
  snapshots: import("./snapshots.ts").SnapshotService;
  rpc: {
    register(
      name: string,
      handler: (params: Record<string, unknown>) => unknown | Promise<unknown>,
    ): () => void;
    invoke(name: string, params: Record<string, unknown>): Promise<unknown>;
  };
  storage: StorageService;
  workspace: WorkspaceService;
  tools: ToolRegistry;
  context: ContextService;
  model: ModelService;
  runtime: RuntimeService;
  approvals: ApprovalService;
  events: {
    publish(event: AppEvent): void;
    subscribe(listener: (event: AppEvent) => void): () => void;
  };
}
