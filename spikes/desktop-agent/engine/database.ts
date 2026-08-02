import { DatabaseSync } from "node:sqlite";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { SessionSummary, StoredMessage } from "../protocol.ts";

interface Row {
  [key: string]: unknown;
}

export class SessionRepository {
  readonly db: DatabaseSync;

  constructor(path: string, readonly workspace: string) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        workspace TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        run_id TEXT REFERENCES runs(id),
        sequence INTEGER NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(session_id, sequence)
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        run_id TEXT REFERENCES runs(id),
        sequence INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(session_id, sequence)
      );
      CREATE TABLE IF NOT EXISTS extension_settings (
        workspace TEXT NOT NULL,
        extension_id TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        PRIMARY KEY(workspace, extension_id)
      );
    `);
    this.db.prepare(
      "UPDATE runs SET status = 'interrupted', finished_at = ? WHERE status = 'running'",
    )
      .run(Date.now());
    this.db.prepare("UPDATE messages SET status = 'interrupted' WHERE status = 'streaming'").run();
  }

  close(): void {
    this.db.close();
  }

  listSessions(): SessionSummary[] {
    return (this.db.prepare(
      "SELECT id, title, updated_at FROM sessions WHERE workspace = ? ORDER BY updated_at DESC",
    ).all(this.workspace) as Row[]).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      updatedAt: Number(row.updated_at),
    }));
  }

  createSession(): string {
    const id = crypto.randomUUID();
    const now = Date.now();
    this.db.prepare(
      "INSERT INTO sessions (id, workspace, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(id, this.workspace, "New session", now, now);
    return id;
  }

  renameFromPrompt(sessionId: string, prompt: string): void {
    const row = this.db.prepare("SELECT title FROM sessions WHERE id = ?").get(sessionId) as Row;
    if (row?.title !== "New session") return;
    const title = prompt.replace(/\s+/g, " ").trim().slice(0, 54) || "New session";
    this.db.prepare("UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?")
      .run(title, Date.now(), sessionId);
  }

  loadMessages(sessionId: string): StoredMessage[] {
    return (this.db.prepare(
      "SELECT id, role, status, payload FROM messages WHERE session_id = ? AND status = 'complete' ORDER BY sequence",
    ).all(sessionId) as Row[]).map((row) => ({
      id: String(row.id),
      role: String(row.role),
      status: "complete",
      message: JSON.parse(String(row.payload)) as AgentMessage,
    }));
  }

  startRun(sessionId: string): string {
    const id = crypto.randomUUID();
    this.db.prepare(
      "INSERT INTO runs (id, session_id, status, started_at) VALUES (?, ?, 'running', ?)",
    )
      .run(id, sessionId, Date.now());
    return id;
  }

  finishRun(runId: string, status: "complete" | "aborted" | "error"): void {
    this.db.prepare("UPDATE runs SET status = ?, finished_at = ? WHERE id = ?")
      .run(status, Date.now(), runId);
  }

  startMessage(sessionId: string, runId: string, message: AgentMessage): StoredMessage {
    const id = crypto.randomUUID();
    const sequence = this.nextSequence("messages", sessionId);
    const role = "role" in message ? String(message.role) : "custom";
    this.db.prepare(
      "INSERT INTO messages (id, session_id, run_id, sequence, role, status, payload, created_at) VALUES (?, ?, ?, ?, ?, 'streaming', ?, ?)",
    ).run(id, sessionId, runId, sequence, role, JSON.stringify(message), Date.now());
    return { id, role, status: "streaming", message };
  }

  updateMessage(record: StoredMessage, message: AgentMessage, complete = false): StoredMessage {
    const status = complete ? "complete" : "streaming";
    this.db.prepare("UPDATE messages SET payload = ?, status = ? WHERE id = ?")
      .run(JSON.stringify(message), status, record.id);
    this.db.prepare(
      "UPDATE sessions SET updated_at = ? WHERE id = (SELECT session_id FROM messages WHERE id = ?)",
    )
      .run(Date.now(), record.id);
    return { ...record, status, message };
  }

  appendEvent(sessionId: string, runId: string | undefined, type: string, payload: unknown): void {
    this.db.prepare(
      "INSERT INTO events (id, session_id, run_id, sequence, type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      crypto.randomUUID(),
      sessionId,
      runId ?? null,
      this.nextSequence("events", sessionId),
      type,
      JSON.stringify(payload),
      Date.now(),
    );
  }

  extensionEnabled(extensionId: string): boolean | undefined {
    const row = this.db.prepare(
      "SELECT enabled FROM extension_settings WHERE workspace = ? AND extension_id = ?",
    ).get(this.workspace, extensionId) as Row | undefined;
    return row ? Number(row.enabled) === 1 : undefined;
  }

  setExtensionEnabled(extensionId: string, enabled: boolean): void {
    this.db.prepare(`
      INSERT INTO extension_settings (workspace, extension_id, enabled) VALUES (?, ?, ?)
      ON CONFLICT(workspace, extension_id) DO UPDATE SET enabled = excluded.enabled
    `).run(this.workspace, extensionId, enabled ? 1 : 0);
  }

  private nextSequence(table: "messages" | "events", sessionId: string): number {
    const row = this.db.prepare(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM ${table} WHERE session_id = ?`,
    ).get(sessionId) as Row;
    return Number(row.next);
  }
}
