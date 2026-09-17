/** SQLite chats. Titles on first user message. Emits session/changed for the live stream. */
import type { Message } from "@earendil-works/pi-ai";

import type { PluginContext } from "../sdk.ts";
import type { Session, SessionSnapshot, SessionStatus } from "../types.ts";

import { DatabaseSync } from "node:sqlite";

import { join } from "@std/path";
import { Service } from "cordis";

declare module "cordis" {
  interface Events {
    "session/changed"(id: string): void;
  }
}

declare module "../sdk.ts" {
  interface Services {
    sessions: Sessions;
  }
}

export default class Sessions extends Service {
  static inject = ["workspace"] as const;
  static provide = "sessions" as const;
  declare ctx: PluginContext<"workspace">;

  private db: DatabaseSync;

  constructor(ctx: PluginContext<"workspace">) {
    super(ctx, "sessions");
    Deno.mkdirSync(ctx.workspace.dataDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(ctx.workspace.dataDir, "sessions.db"));
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    ctx.effect(() => () => this.db.close());
  }

  list(): Session[] {
    return this.db.prepare("SELECT * FROM sessions ORDER BY updated_at DESC").all().map(row);
  }

  create(input: { provider?: string; model?: string } = {}): Session {
    const now = Date.now();
    const session: Session = {
      id: crypto.randomUUID(),
      title: "New chat",
      provider: input.provider ?? "",
      model: input.model ?? "",
      status: "idle",
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        "INSERT INTO sessions (id, title, provider, model, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        session.id,
        session.title,
        session.provider,
        session.model,
        session.status,
        session.createdAt,
        session.updatedAt,
      );
    this.ctx.emit("session/changed", session.id);
    return session;
  }

  get(id: string): Session {
    const found = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
    if (!found) throw new Error("Session not found");
    return row(found);
  }

  snapshot(id: string): SessionSnapshot {
    return { ...this.get(id), messages: this.messages(id) };
  }

  update(id: string, patch: Partial<Pick<Session, "title" | "provider" | "model" | "status">>) {
    const session = { ...this.get(id), ...patch, updatedAt: Date.now() };
    this.db
      .prepare(
        "UPDATE sessions SET title = ?, provider = ?, model = ?, status = ?, updated_at = ? WHERE id = ?",
      )
      .run(session.title, session.provider, session.model, session.status, session.updatedAt, id);
    this.ctx.emit("session/changed", id);
    return session;
  }

  messages(id: string): Message[] {
    this.get(id);
    return this.db
      .prepare("SELECT data FROM messages WHERE session_id = ? ORDER BY id")
      .all(id)
      .map((entry) => JSON.parse(String(entry.data)));
  }

  append(id: string, message: Message) {
    const session = this.get(id);
    this.db
      .prepare("INSERT INTO messages (session_id, data, created_at) VALUES (?, ?, ?)")
      .run(id, JSON.stringify(message), Date.now());
    const title =
      session.title === "New chat" && message.role === "user"
        ? heading(message.content)
        : session.title;
    this.db
      .prepare("UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?")
      .run(title, Date.now(), id);
    this.ctx.emit("session/changed", id);
  }

  replaceLast(id: string, message: Message) {
    const last = this.db
      .prepare("SELECT id FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT 1")
      .get(id);
    if (!last) {
      this.append(id, message);
      return;
    }
    this.db
      .prepare("UPDATE messages SET data = ? WHERE id = ?")
      .run(JSON.stringify(message), last.id);
    this.ctx.emit("session/changed", id);
  }

  setStatus(id: string, status: SessionStatus) {
    this.update(id, { status });
  }
}

function heading(content: Message["content"]) {
  const text =
    typeof content === "string"
      ? content
      : content.map((block) => (block.type === "text" ? block.text : "")).join("");
  return text.trim().split("\n")[0].slice(0, 72) || "New chat";
}

function row(entry: Record<string, unknown>): Session {
  return {
    id: String(entry.id),
    title: String(entry.title),
    provider: String(entry.provider),
    model: String(entry.model),
    status: entry.status as SessionStatus,
    createdAt: Number(entry.created_at),
    updatedAt: Number(entry.updated_at),
  };
}
