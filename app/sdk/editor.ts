/** One-based inclusive lines for editor navigation and file activity. */
export interface FileRange {
  startLine: number;
  endLine: number;
}

export interface FileActivity {
  path: string;
  changed: boolean;
  range?: FileRange;
}

export interface CompletionPosition {
  /** Zero-based line and UTF-16 character offset. */
  line: number;
  character: number;
}

export interface CompletionRange {
  start: CompletionPosition;
  end: CompletionPosition;
}

export interface Diagnostic {
  range: CompletionRange;
  message: string;
  severity?: number;
  source?: string;
}

export interface CompletionTextEdit {
  range: CompletionRange;
  newText: string;
}

export interface CompletionInsertReplaceEdit {
  insert: CompletionRange;
  replace: CompletionRange;
  newText: string;
}

export interface CompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string | { kind: "plaintext" | "markdown"; value: string };
  insertText?: string;
  insertTextFormat?: 1 | 2;
  sortText?: string;
  filterText?: string;
  textEdit?: CompletionTextEdit | CompletionInsertReplaceEdit;
  additionalTextEdits?: CompletionTextEdit[];
}

export interface CompletionResult {
  isIncomplete: boolean;
  items: CompletionItem[];
}

export interface LanguageServerStatus {
  name: string;
  running: boolean;
  error?: string;
  /** Counts for documents reported by the server, not a repository scan. */
  errors: number;
  warnings: number;
}

/** Local stdio server. Commands run directly (no shell), with the workspace cwd. */
export interface LanguageServerRegistration {
  id: string;
  name: string;
  command: string;
  args?: readonly string[];
  /** Lowercase extensions including the dot, e.g. { ".rs": "rust" }. */
  languages: Readonly<Record<string, string>>;
  initializationOptions?: unknown;
  /** Higher wins; ties use ascending, case-sensitive id, independent of load order. */
  priority?: number;
}

export interface LanguageServerRegistrationOptions {
  /** Explicitly retire an existing id. Disposal does not restore the old registration. */
  replace?: boolean;
}

export interface RegisteredLanguageServerStatus extends LanguageServerStatus {
  id: string;
  priority: number;
  languages: Readonly<Record<string, string>>;
  state: "starting" | "running" | "unavailable";
}

export interface DocumentDiagnostics {
  /** Workspace-relative path and absolute file URI. */
  path: string;
  uri: string;
  serverId?: string;
  diagnostics: Diagnostic[];
}

/** Shared backend gateway for editor, file tools, and agent diagnostic consumers. */
export interface LspService {
  /** Use ctx.effect(() => lsp.register(...)) to bind the async disposer to Cordis. */
  register(
    server: LanguageServerRegistration,
    options?: LanguageServerRegistrationOptions,
  ): () => Promise<void>;
  /** Restart an existing scoped registration and rebind retained unsaved text.
   * Concurrent calls share recovery; rejects on failure, unload or disposal.
   */
  restart(id: string): Promise<RegisteredLanguageServerStatus>;
  /** Paths are authorized by WorkspaceService; text is limited to 4 MB. */
  update(path: string, text: string): Promise<void>;
  /** Forget a document and clear its diagnostics; does not change files or saved drafts. */
  close(path: string): Promise<void>;
  completion(path: string, text: string, position: CompletionPosition): Promise<CompletionResult>;
  /** Latest push diagnostics, not a compiler barrier. Opens untracked files from disk. */
  getDiagnostics(paths: readonly string[]): Promise<DocumentDiagnostics[]>;
  /** Legacy Deno status without a path; selected server status with a path. */
  status(path?: string): Promise<LanguageServerStatus>;
  servers(): RegisteredLanguageServerStatus[];
}
