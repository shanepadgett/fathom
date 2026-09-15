import type {
  CompletionItem,
  CompletionPosition,
  CompletionResult,
  Diagnostic,
  LanguageServerRegistration,
  RegisteredLanguageServerStatus,
} from "../../sdk/editor.ts";

import { spawn } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  CancellationTokenSource,
  createMessageConnection,
  ResponseError,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node";

interface InitializeResult {
  capabilities?: {
    textDocumentSync?: number | { openClose?: boolean; change?: number };
    completionProvider?: {
      resolveProvider?: boolean;
      triggerCharacters?: string[];
    };
  };
}

const emptyCompletion = (): CompletionResult => ({
  isIncomplete: false,
  items: [],
});

async function bounded<T>(
  work: Promise<T>,
  milliseconds: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function isPosition(value: unknown): value is CompletionPosition {
  if (!value || typeof value !== "object") return false;
  const position = value as CompletionPosition;
  return Number.isSafeInteger(position.line) && position.line >= 0 &&
    Number.isSafeInteger(position.character) && position.character >= 0;
}

function isDiagnostic(value: unknown): value is Diagnostic {
  if (!value || typeof value !== "object") return false;
  const item = value as Diagnostic;
  return typeof item.message === "string" && !!item.range &&
    isPosition(item.range.start) && isPosition(item.range.end) &&
    (item.range.end.line > item.range.start.line ||
      (item.range.end.line === item.range.start.line &&
        item.range.end.character >= item.range.start.character)) &&
    (item.severity === undefined || [1, 2, 3, 4].includes(item.severity));
}

/** One stdio transport per registration; the gateway owns document routing. */
export class LanguageServer {
  private child;
  private rpc;
  private documents = new Map<string, { version: number; text: string }>();
  private versions = new Map<string, number>();
  private ready = false;
  private disposed = false;
  private disposal?: Promise<void>;
  private closed: Promise<void>;
  private spawned: Promise<boolean>;
  private syncKind = 1;
  private openClose = true;
  private supportsCompletion = false;
  readonly diagnostics = new Map<string, Diagnostic[]>();
  error?: string;

  constructor(
    private registration: LanguageServerRegistration,
    root: string,
    private changed: (uri: string) => void,
    private statusChanged: () => void,
  ) {
    this.child = spawn(registration.command, [...(registration.args ?? [])], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      // A separate POSIX process group also owns server-spawned helper processes.
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    this.spawned = new Promise((resolve) => {
      this.child.once("spawn", () => resolve(true));
      this.child.once("error", () => resolve(false));
    });
    this.child.stderr.resume();
    this.rpc = createMessageConnection(
      new StreamMessageReader(this.child.stdout),
      new StreamMessageWriter(this.child.stdin),
    );
    this.closed = new Promise((resolve) => {
      this.child.once("close", () => {
        resolve();
        if (!this.disposed) this.fail(new Error("Language server stopped"));
      });
    });
    this.child.on("error", (error) => this.fail(error));
    this.child.once("exit", () => {
      // Helpers can retain inherited pipes after the leader exits, delaying close.
      if (!this.disposed) this.fail(new Error("Language server stopped"));
    });
    this.rpc.onError(([error]) => this.fail(error));
    this.rpc.onClose(() => {
      if (!this.disposed) {
        this.fail(new Error("Language server connection closed"));
      }
    });
    this.rpc.onNotification("textDocument/publishDiagnostics", (
      params: {
        uri?: unknown;
        version?: unknown;
        diagnostics?: unknown;
      } | null,
    ) => {
      if (this.disposed || typeof params?.uri !== "string") return;
      const document = this.documents.get(params.uri);
      // Never accept another server's documents, external URIs, or old versions.
      if (
        !document ||
        (params.version !== undefined && params.version !== document.version)
      ) return;
      if (!Array.isArray(params.diagnostics)) return;
      this.diagnostics.set(
        params.uri,
        params.diagnostics.filter(isDiagnostic).map((diagnostic) => ({
          ...diagnostic,
          // LSP leaves omitted severity to the client. Match Monaco's existing
          // error default for status counts and agent review as well.
          severity: diagnostic.severity ?? 1,
        })),
      );
      this.changed(params.uri);
      this.statusChanged();
    });
    // Only advertise capabilities implemented here. Unknown requests retain the
    // JSON-RPC library's MethodNotFound response (no silent, hanging requests).
    this.rpc.onRequest(
      "workspace/configuration",
      (params: { items?: { section?: string }[] }) => {
        return (params?.items ?? []).map(({ section }) => {
          let value: unknown = registration.initializationOptions ?? null;
          if (!section || section === registration.id) return value;
          for (const key of section.split(".")) {
            if (
              !value || typeof value !== "object" || !Object.hasOwn(value, key)
            ) return null;
            value = (value as Record<string, unknown>)[key];
          }
          return value;
        });
      },
    );
    this.rpc.onRequest("workspace/workspaceFolders", () => [{
      uri: pathToFileURL(root + "/").href,
      name: root.split(/[\\/]/).filter(Boolean).pop() ?? root,
    }]);
    this.rpc.listen();
  }

  private fail(error: unknown) {
    if (this.disposed) return;
    this.error = error instanceof Error ? error.message : String(error);
    // Disposing rejects pending JSON-RPC requests; cancellation alone does not.
    void this.dispose();
    this.statusChanged();
  }

  async initialize(root: string): Promise<void> {
    try {
      // Missing executables emit error without spawn. Do not enqueue JSON-RPC
      // writes against the already-destroyed stdin of a failed child.
      if (!await this.spawned || this.disposed) return;
      await bounded(
        (async () => {
          const result = await this.rpc.sendRequest<InitializeResult>(
            "initialize",
            {
              processId: process.pid,
              rootUri: pathToFileURL(root + "/").href,
              capabilities: {
                workspace: { configuration: true, workspaceFolders: true },
                textDocument: {
                  publishDiagnostics: { versionSupport: true },
                  completion: {
                    completionItem: {
                      snippetSupport: true,
                      documentationFormat: ["markdown", "plaintext"],
                      insertReplaceSupport: true,
                    },
                  },
                },
              },
              initializationOptions: this.registration.initializationOptions ??
                null,
            },
          );
          if (this.disposed) return;
          const completion = result?.capabilities?.completionProvider;
          this.supportsCompletion = !!completion &&
            typeof completion === "object" && !Array.isArray(completion);
          const sync = result?.capabilities?.textDocumentSync;
          this.syncKind = typeof sync === "number" ? sync : sync?.change ?? 0;
          this.openClose = typeof sync === "number"
            ? sync !== 0
            : sync?.openClose ?? false;
          await this.rpc.sendNotification("initialized", {});
          if (!this.disposed) this.ready = true;
        })(),
        8000,
        "Language server startup timed out",
      );
    } catch (error) {
      this.fail(error);
    } finally {
      this.statusChanged();
    }
  }

  async update(path: string, text: string, languageId: string): Promise<void> {
    if (!this.ready) return;
    const uri = pathToFileURL(path).href;
    const previous = this.documents.get(uri);
    if (previous?.text === text) return;
    const version = (this.versions.get(uri) ?? 0) + 1;
    this.versions.set(uri, version);
    this.documents.set(uri, { version, text });
    this.diagnostics.delete(uri);
    this.changed(uri);
    this.statusChanged();
    try {
      if (!previous) {
        if (this.openClose) {
          await bounded(
            this.rpc.sendNotification("textDocument/didOpen", {
              textDocument: { uri, text, version, languageId },
            }),
            3000,
            "Language server update timed out",
          );
        }
      } else if (this.syncKind !== 0) {
        const lines = previous.text.split(/\r\n|\r|\n/);
        // An incremental server can receive one edit replacing the entire old
        // document. All positions are UTF-16 (the protocol default).
        const change = this.syncKind === 2
          ? {
            range: {
              start: { line: 0, character: 0 },
              end: {
                line: lines.length - 1,
                character: lines[lines.length - 1].length,
              },
            },
            text,
          }
          : { text };
        await bounded(
          this.rpc.sendNotification("textDocument/didChange", {
            textDocument: { uri, version },
            contentChanges: [change],
          }),
          3000,
          "Language server update timed out",
        );
      }
    } catch (error) {
      this.fail(error);
    }
  }

  async close(path: string): Promise<void> {
    const uri = pathToFileURL(path).href;
    if (!this.documents.delete(uri)) return;
    this.diagnostics.delete(uri);
    this.changed(uri);
    this.statusChanged();
    if (!this.ready || !this.openClose) return;
    try {
      await bounded(
        this.rpc.sendNotification("textDocument/didClose", {
          textDocument: { uri },
        }),
        3000,
        "Language server close timed out",
      );
    } catch (error) {
      this.fail(error);
    }
  }

  async completion(
    path: string,
    position: CompletionPosition,
  ): Promise<CompletionResult> {
    if (!this.ready || !this.supportsCompletion) return emptyCompletion();
    const cancellation = new CancellationTokenSource();
    try {
      const result = await bounded(
        this.rpc.sendRequest<CompletionItem[] | CompletionResult | null>(
          "textDocument/completion",
          { textDocument: { uri: pathToFileURL(path).href }, position },
          cancellation.token,
        ),
        3000,
        "Language server completion timed out",
      );
      if (!result || this.disposed) return emptyCompletion();
      const items = Array.isArray(result) ? result : result.items;
      if (!Array.isArray(items)) return emptyCompletion();
      return {
        isIncomplete: Array.isArray(result) ? false : !!result.isIncomplete,
        items: items.filter((item) => item && typeof item.label === "string")
          .map((item) => ({
            label: item.label,
            kind: item.kind,
            detail: item.detail,
            documentation: item.documentation,
            insertText: item.insertText,
            insertTextFormat: item.insertTextFormat,
            sortText: item.sortText,
            filterText: item.filterText,
            textEdit: item.textEdit,
            additionalTextEdits: item.additionalTextEdits,
          })),
      };
    } catch (error) {
      cancellation.cancel();
      // ContentModified, RequestCancelled and unsupported completion requests
      // are normal protocol errors, not evidence of a broken transport.
      if (!(error instanceof ResponseError)) this.fail(error);
      return emptyCompletion();
    } finally {
      cancellation.dispose();
    }
  }

  status(): RegisteredLanguageServerStatus {
    const diagnostics = [...this.diagnostics.values()].flat();
    return {
      id: this.registration.id,
      name: this.registration.name,
      priority: this.registration.priority ?? 0,
      languages: { ...this.registration.languages },
      state: this.ready
        ? "running"
        : this.error || this.disposed
        ? "unavailable"
        : "starting",
      running: this.ready,
      error: this.error,
      errors: diagnostics.filter((item) => item.severity === 1).length,
      warnings: diagnostics.filter((item) => item.severity === 2).length,
    };
  }

  dispose(): Promise<void> {
    return this.disposal ??= this.shutdown();
  }

  private signal(signal: "SIGTERM" | "SIGKILL") {
    try {
      if (process.platform !== "win32" && this.child.pid) {
        process.kill(-this.child.pid, signal);
      } else this.child.kill(signal);
    } catch {
      // Already exited, including ENOENT spawn failures.
    }
  }

  private async shutdown(): Promise<void> {
    const wasReady = this.ready;
    this.disposed = true;
    this.ready = false;
    for (const uri of this.diagnostics.keys()) {
      this.diagnostics.delete(uri);
      this.changed(uri);
    }
    this.documents.clear();
    this.versions.clear();
    try {
      await bounded(
        (async () => {
          if (wasReady) {
            await this.rpc.sendRequest("shutdown");
            await this.rpc.sendNotification("exit");
          } else this.signal("SIGTERM");
          await this.closed;
        })(),
        1500,
        "Language server shutdown timed out",
      );
    } catch {
      // An unresponsive server must not keep an environment alive.
    } finally {
      if (process.platform === "win32" && this.child.pid) {
        try {
          const killer = spawn("taskkill", [
            "/pid",
            String(this.child.pid),
            "/T",
            "/F",
          ], {
            stdio: "ignore",
            windowsHide: true,
          });
          try {
            await bounded(
              new Promise<void>((resolve) => {
                killer.once("error", () => resolve());
                killer.once("close", () => resolve());
              }),
              1500,
              "Process tree cleanup timed out",
            );
          } finally {
            killer.kill();
          }
        } catch {
          // Still terminate the leader and dispose the transport if taskkill fails.
        }
      }
      this.signal("SIGKILL");
      this.rpc.dispose();
      this.child.stdin.destroy();
      this.child.stdout.destroy();
      this.child.stderr.destroy();
      try {
        await bounded(
          this.closed,
          1500,
          "Language server did not close after termination",
        );
      } catch {
        // Streams and pending RPCs are already disposed even if the OS delays close.
      }
      this.statusChanged();
    }
  }
}
