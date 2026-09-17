import type {
  CompletionPosition,
  CompletionResult,
  DocumentDiagnostics,
  LanguageServerRegistration,
  LanguageServerRegistrationOptions,
  LanguageServerStatus,
  LspService,
  RegisteredLanguageServerStatus,
} from "../../sdk/editor.ts";
import type { Services, WorkspaceService } from "../../sdk/services.ts";

import { relative } from "node:path";
import { pathToFileURL } from "node:url";

import { LanguageServer } from "./lsp.ts";
import { editorPosition, editorText, readEditorText } from "./text.ts";

interface Registration {
  definition: LanguageServerRegistration;
  client?: LanguageServer;
  started: Promise<void>;
  ownership: object;
  restarting?: Promise<RegisteredLanguageServerStatus>;
  error?: string;
}

interface Document {
  text: string;
  owner?: Registration;
}

function definition(value: LanguageServerRegistration): LanguageServerRegistration {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.id !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/.test(value.id) ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.includes("\0") ||
    typeof value.command !== "string" ||
    !value.command.trim() ||
    value.command.includes("\0")
  ) {
    throw new Error("Invalid language server id, name, or command");
  }
  if (
    value.args !== undefined &&
    (!Array.isArray(value.args) ||
      value.args.some((arg) => typeof arg !== "string" || arg.includes("\0")))
  ) {
    throw new Error("Language server arguments must be strings without NUL bytes");
  }
  if (value.priority !== undefined && !Number.isSafeInteger(value.priority)) {
    throw new Error("Language server priority must be a safe integer");
  }
  if (!value.languages || typeof value.languages !== "object" || Array.isArray(value.languages)) {
    throw new Error("Language server extensions must map to language ids");
  }
  const languages = Object.entries(value.languages);
  if (
    !languages.length ||
    languages.some(
      ([extension, language]) =>
        !/^\.[a-z0-9][a-z0-9._+-]*$/.test(extension) ||
        typeof language !== "string" ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/.test(language),
    )
  ) {
    throw new Error("Invalid language server extension or language id");
  }
  let initializationOptions: unknown;
  if (value.initializationOptions !== undefined) {
    try {
      initializationOptions = JSON.parse(
        JSON.stringify(value.initializationOptions, (_key, item) => {
          if (
            typeof item === "function" ||
            typeof item === "symbol" ||
            typeof item === "bigint" ||
            item === undefined ||
            (typeof item === "number" && !Number.isFinite(item))
          ) {
            throw new Error("Not JSON");
          }
          return item;
        }),
      );
    } catch {
      throw new Error("Language server initialization options must be JSON data");
    }
  }
  return {
    id: value.id,
    name: value.name,
    command: value.command,
    args: [...(value.args ?? [])],
    languages: Object.fromEntries(languages),
    initializationOptions,
    priority: value.priority ?? 0,
  };
}

function language(registration: Registration, path: string): string | undefined {
  const suffix = Object.keys(registration.definition.languages)
    .sort((a, b) => b.length - a.length)
    .find((extension) => path.toLowerCase().endsWith(extension));
  return suffix ? registration.definition.languages[suffix] : undefined;
}

function compare(a: Registration, b: Registration): number {
  return (
    (b.definition.priority ?? 0) - (a.definition.priority ?? 0) ||
    (a.definition.id < b.definition.id ? -1 : a.definition.id > b.definition.id ? 1 : 0)
  );
}

/** Cordis-provided gateway. Registrations are plugin effects, not RPC commands. */
export class EditorLspService implements LspService {
  private registrations = new Map<string, Registration>();
  private documents = new Map<string, Document>();
  private queues = new Map<string, Promise<unknown>>();
  private retiring = new Set<Promise<void>>();
  private disposed = false;
  private disposal?: Promise<void>;

  constructor(
    private workspace: WorkspaceService,
    private events: Services["events"],
  ) {}

  private assertActive() {
    if (this.disposed) throw new Error("Language server service is disposed");
  }

  private async path(value: string): Promise<string> {
    this.assertActive();
    if (typeof value !== "string" || !value.trim() || value.includes("\0")) {
      throw new Error("Invalid language server path");
    }
    try {
      return await this.workspace.resolve(value);
    } catch (error) {
      // Unsaved/new documents are allowed only under writable workspace roots.
      if (!(error instanceof Deno.errors.NotFound)) throw error;
      return await this.workspace.resolve(value, true);
    }
  }

  private enqueue<T>(path: string, work: () => Promise<T>): Promise<T> {
    const next = (this.queues.get(path) ?? Promise.resolve())
      .catch(() => {})
      .then(() => {
        this.assertActive();
        return work();
      });
    this.queues.set(path, next);
    void next
      .finally(() => {
        if (this.queues.get(path) === next) this.queues.delete(path);
      })
      .catch(() => {});
    return next;
  }

  private publish(path: string) {
    if (this.disposed) return;
    const document = this.documents.get(path);
    const uri = pathToFileURL(path).href;
    const owner = document?.owner;
    const current = owner && this.registrations.get(owner.definition.id) === owner;
    this.events.publish({
      type: "diagnostics",
      data: {
        uri,
        diagnostics: current ? (owner.client?.diagnostics.get(uri) ?? []) : [],
        serverId: current ? owner.definition.id : undefined,
      },
    });
  }

  private refresh() {
    if (this.disposed) return;
    for (const path of this.documents.keys()) {
      void this.enqueue(path, async () => {
        const document = this.documents.get(path);
        if (document) await this.route(path, document.text);
      }).catch(() => {});
    }
  }

  private retire(registration: Registration): Promise<void> {
    const pending = registration.client?.dispose() ?? Promise.resolve();
    this.retiring.add(pending);
    void pending.finally(() => this.retiring.delete(pending)).catch(() => {});
    return pending;
  }

  register(
    value: LanguageServerRegistration,
    options: LanguageServerRegistrationOptions = {},
  ): () => Promise<void> {
    this.assertActive();
    const config = definition(value);
    if (
      !options ||
      typeof options !== "object" ||
      (options.replace !== undefined && typeof options.replace !== "boolean")
    ) {
      throw new Error("Invalid language server registration options");
    }
    const previous = this.registrations.get(config.id);
    if (previous && !options.replace) {
      throw new Error(`Language server already registered: ${config.id}`);
    }
    const registration: Registration = {
      definition: config,
      ownership: {},
      started: Promise.resolve(),
    };
    this.registrations.set(config.id, registration);
    if (previous) void this.retire(previous);
    this.start(registration);
    for (const path of this.documents.keys()) this.publish(path);
    this.events.publish({ type: "language-server" });
    this.refresh();
    let disposal: Promise<void> | undefined;
    return () =>
      (disposal ??= (async () => {
        // An old plugin's disposer must never unregister its replacement.
        const current = this.registrations.get(config.id);
        if (current?.ownership === registration.ownership) {
          this.registrations.delete(config.id);
          for (const path of this.documents.keys()) this.publish(path);
          if (!this.disposed) this.events.publish({ type: "language-server" });
          this.refresh();
        }
        await this.retire(registration);
        if (current?.ownership === registration.ownership) {
          await this.retire(current);
          await current.restarting?.catch(() => {});
        }
      })());
  }

  private start(registration: Registration) {
    const config = registration.definition;
    registration.started = Promise.resolve();
    try {
      registration.client = new LanguageServer(
        config,
        this.workspace.root,
        (uri) => {
          if (this.registrations.get(config.id) !== registration) return;
          // Only the current owner may publish markers. URI values never bypass
          // the gateway's authorized-document map.
          for (const [path, document] of this.documents) {
            if (document.owner === registration && pathToFileURL(path).href === uri)
              this.publish(path);
          }
        },
        () => {
          if (this.disposed || this.registrations.get(config.id) !== registration) return;
          this.events.publish({ type: "language-server" });
          // Diagnostics also change status counts; reroute only failed owners.
          if (registration.client?.status().state === "unavailable") {
            this.refresh();
          }
        },
      );
      registration.started = registration.client.initialize(this.workspace.root).then(() => {
        if (this.registrations.get(config.id) === registration) {
          this.refresh();
        }
      });
    } catch (error) {
      registration.error = error instanceof Error ? error.message : String(error);
    }
  }

  restart(id: string): Promise<RegisteredLanguageServerStatus> {
    this.assertActive();
    if (typeof id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/.test(id)) {
      throw new Error("Invalid language server id");
    }
    const previous = this.registrations.get(id);
    if (!previous) throw new Error(`Language server is not registered: ${id}`);
    if (previous.restarting) return previous.restarting;
    // Preserve scoped ownership; each process gets a distinct routing identity.
    const registration: Registration = {
      definition: previous.definition,
      ownership: previous.ownership,
      started: Promise.resolve(),
    };
    this.registrations.set(id, registration);
    const active = () => {
      this.assertActive();
      if (this.registrations.get(id) !== registration) {
        throw new Error(`Language server restart retired: ${id}`);
      }
    };
    const stopped = this.retire(previous);
    const starting = stopped.then(async () => {
      active();
      this.start(registration);
      await registration.started;
      active();
    });
    // Selection waits for shutdown/startup, not queues that wait on selection.
    registration.started = starting;
    const pending = starting.then(async () => {
      await Promise.all(
        [...this.documents.keys()].map((path) =>
          this.enqueue(path, async () => {
            active();
            const document = this.documents.get(path);
            if (document) await this.route(path, document.text);
          }),
        ),
      );
      active();
      const status = registration.client?.status();
      if (!status?.running) {
        throw new Error(status?.error ?? registration.error ?? "Language server restart failed");
      }
      return status;
    });
    registration.restarting = pending;
    void pending
      .finally(() => {
        registration.restarting = undefined;
        if (!this.disposed && this.registrations.get(id) === registration) {
          this.events.publish({ type: "language-server" });
        }
      })
      .catch(() => {});
    for (const path of this.documents.keys()) this.publish(path);
    this.events.publish({ type: "language-server" });
    return pending;
  }

  private async select(path: string): Promise<Registration | undefined> {
    const candidates = [...this.registrations.values()]
      .filter((entry) => language(entry, path))
      .sort(compare);
    // Startup runs concurrently, so fallback never multiplies the 8s deadline.
    await Promise.all(candidates.map((entry) => entry.started));
    if (this.disposed) return;
    return candidates.find(
      (entry) =>
        this.registrations.get(entry.definition.id) === entry && entry.client?.status().running,
    );
  }

  private async route(path: string, text: string): Promise<Registration | undefined> {
    let document = this.documents.get(path);
    if (!document) {
      document = { text };
      this.documents.set(path, document);
    }
    document.text = text;
    const owner = await this.select(path);
    this.assertActive();
    if (owner !== document.owner) {
      const previous = document.owner;
      document.owner = owner;
      this.publish(path);
      if (previous) await previous.client?.close(path);
    }
    if (owner) await owner.client?.update(path, text, language(owner, path)!);
    return owner;
  }

  async update(value: string, valueText: string): Promise<void> {
    const text = editorText(valueText);
    const path = await this.path(value);
    await this.enqueue(path, async () => {
      await this.route(path, text);
    });
  }

  async close(value: string): Promise<void> {
    const path = await this.path(value);
    await this.enqueue(path, async () => {
      const document = this.documents.get(path);
      this.documents.delete(path);
      this.publish(path);
      await document?.owner?.client?.close(path);
    });
  }

  async completion(
    value: string,
    valueText: string,
    valuePosition: CompletionPosition,
  ): Promise<CompletionResult> {
    const text = editorText(valueText);
    const position = editorPosition(valuePosition, text);
    const path = await this.path(value);
    const empty: CompletionResult = { isIncomplete: false, items: [] };
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.enqueue(path, async () => {
          if (expired) return empty;
          const owner = await this.route(path, text);
          if (expired || !owner) return empty;
          const result = (await owner.client?.completion(path, position)) ?? empty;
          return !expired && this.registrations.get(owner.definition.id) === owner ? result : empty;
        }),
        // Includes queueing, startup, synchronization and the 3s RPC request.
        new Promise<CompletionResult>((resolve) => {
          timer = setTimeout(() => {
            expired = true;
            resolve(empty);
          }, 15_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async getDiagnostics(values: readonly string[]): Promise<DocumentDiagnostics[]> {
    this.assertActive();
    if (!Array.isArray(values) || values.length > 3000) {
      throw new Error("Expected at most 3000 diagnostic paths");
    }
    const results: DocumentDiagnostics[] = [];
    const seen = new Set<string>();
    // Bound authorization and synchronization too, not just the underlying reads.
    // readEditorText additionally limits aggregate I/O across concurrent callers.
    for (let offset = 0; offset < values.length; offset += 4) {
      const paths = await Promise.all(
        values.slice(offset, offset + 4).map((value) => this.path(value)),
      );
      const unique = paths.filter((path) => {
        if (seen.has(path)) return false;
        seen.add(path);
        return true;
      });
      results.push(
        ...(await Promise.all(
          unique.map((path) =>
            this.enqueue(path, async () => {
              const text = this.documents.get(path)?.text ?? (await readEditorText(path));
              await this.route(path, text);
              const owner = this.documents.get(path)?.owner;
              const uri = pathToFileURL(path).href;
              return {
                path: relative(this.workspace.root, path),
                uri,
                serverId: owner?.definition.id,
                diagnostics: structuredClone(owner?.client?.diagnostics.get(uri) ?? []),
              };
            }),
          ),
        )),
      );
    }
    return results;
  }

  servers(): RegisteredLanguageServerStatus[] {
    this.assertActive();
    return [...this.registrations.values()].sort(compare).map(
      (entry) =>
        entry.client?.status() ?? {
          id: entry.definition.id,
          name: entry.definition.name,
          priority: entry.definition.priority ?? 0,
          languages: { ...entry.definition.languages },
          running: false,
          state: entry.restarting ? "starting" : "unavailable",
          error: entry.error,
          errors: 0,
          warnings: 0,
        },
    );
  }

  async status(value?: string): Promise<LanguageServerStatus> {
    this.assertActive();
    if (value === undefined) {
      return (
        this.servers().find((entry) => entry.id === "deno") ?? {
          name: "Deno",
          running: false,
          errors: 0,
          warnings: 0,
        }
      );
    }
    const path = await this.path(value);
    const selected = await this.select(path);
    const candidate =
      selected ??
      [...this.registrations.values()].filter((entry) => language(entry, path)).sort(compare)[0];
    return candidate
      ? this.servers().find((entry) => entry.id === candidate.definition.id)!
      : {
          name: "No language server",
          running: false,
          errors: 0,
          warnings: 0,
        };
  }

  dispose(): Promise<void> {
    return (this.disposal ??= (async () => {
      this.disposed = true;
      const entries = [...this.registrations.values()];
      this.registrations.clear();
      await Promise.all([...entries.map((entry) => this.retire(entry)), ...this.retiring]);
      await Promise.allSettled(entries.map((entry) => entry.restarting));
      await Promise.allSettled(this.queues.values());
      this.documents.clear();
    })());
  }
}
