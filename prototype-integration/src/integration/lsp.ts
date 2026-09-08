import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node";

export interface Diagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  message: string;
  severity?: number;
  source?: string;
  code?: string | number;
}
export interface Document {
  path: string;
  uri: string;
  text: string;
  saved: string;
  version: number;
  diagnostics: Diagnostic[];
  diagnosticVersion?: number;
}

/** One document store and one language server for both editor and agent. */
export class LanguageService {
  readonly documents = new Map<string, Document>();
  private child;
  private rpc;
  private ended;
  constructor(readonly root: string) {
    this.child = spawn(Deno.env.get("FATHOM_DENO") ?? "deno", ["lsp"], {
      cwd: root,
      stdio: ["pipe", "pipe", "inherit"],
    });
    this.ended = new Promise<void>((done) => this.child.once("close", () => done()));
    this.rpc = createMessageConnection(
      new StreamMessageReader(this.child.stdout),
      new StreamMessageWriter(this.child.stdin),
    );
    this.child.on("error", (error) => {
      console.error("LSP:", error.message);
      this.rpc.dispose();
    });
    this.rpc.onNotification(
      "textDocument/publishDiagnostics",
      (params: { uri: string; version?: number; diagnostics: Diagnostic[] }) => {
        const doc = [...this.documents.values()].find((d) => d.uri === params.uri);
        if (!doc || (params.version !== undefined && params.version !== doc.version)) return;
        doc.diagnostics = params.diagnostics;
        doc.diagnosticVersion = doc.version;
      },
    );
    this.rpc.listen();
  }
  async init() {
    await this.rpc.sendRequest("initialize", {
      processId: Deno.pid,
      rootUri: pathToFileURL(this.root + "/").href,
      capabilities: {
        textDocument: { publishDiagnostics: { versionSupport: true } },
      },
      initializationOptions: { enable: true, lint: true },
      workspaceFolders: [
        {
          uri: pathToFileURL(this.root).href,
          name: "prototype",
        },
      ],
    });
    await this.rpc.sendNotification("initialized", {});
  }
  async open(path: string) {
    path = resolve(this.root, path);
    const existing = this.documents.get(path);
    if (existing) return existing;
    const text = await Deno.readTextFile(path);
    const doc: Document = {
      path,
      uri: pathToFileURL(path).href,
      text,
      saved: text,
      version: 1,
      diagnostics: [],
    };
    this.documents.set(path, doc);
    await this.rpc.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: doc.uri,
        languageId: "typescript",
        version: 1,
        text,
      },
    });
    return doc;
  }
  async change(path: string, text: string, version: number) {
    const doc = await this.open(path);
    if (version !== doc.version) {
      throw new Error("Document changed. Reload before editing.");
    }
    doc.text = text;
    doc.version++;
    doc.diagnostics = [];
    doc.diagnosticVersion = undefined;
    await this.rpc.sendNotification("textDocument/didChange", {
      textDocument: { uri: doc.uri, version: doc.version },
      contentChanges: [{ text }],
    });
    return doc;
  }
  async save(path: string, version: number) {
    const doc = await this.open(path);
    if (doc.version !== version) {
      throw new Error("Document changed. Reload before saving.");
    }
    if ((await Deno.readTextFile(doc.path)) !== doc.saved) {
      throw new Error("File changed on disk. Resolve the conflict before saving.");
    }
    await Deno.writeTextFile(doc.path, doc.text);
    doc.saved = doc.text;
    await this.rpc.sendNotification("textDocument/didSave", {
      textDocument: { uri: doc.uri },
      text: doc.text,
    });
    return doc;
  }
  async refresh() {
    for (const doc of this.documents.values()) {
      const disk = await Deno.readTextFile(doc.path);
      if (disk !== doc.saved && doc.text === doc.saved) {
        await this.change(doc.path, disk, doc.version);
        doc.saved = disk;
      }
    }
  }
  async diagnostics(path: string) {
    const doc = await this.open(path);
    const deadline = Date.now() + 5000;
    while (doc.diagnosticVersion !== doc.version && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return {
      path: doc.path,
      version: doc.version,
      pending: doc.diagnosticVersion !== doc.version,
      diagnostics: doc.diagnostics,
    };
  }
  async dispose() {
    const timer = setTimeout(() => this.child.kill("SIGKILL"), 2000);
    try {
      await Promise.race([this.rpc.sendRequest("shutdown"), this.ended]);
      await this.rpc.sendNotification("exit");
      await this.ended;
    } catch {
      this.child.kill("SIGKILL");
    } finally {
      clearTimeout(timer);
      this.rpc.dispose();
    }
  }
}
