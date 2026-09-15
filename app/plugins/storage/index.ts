import type {
  Entry,
  Session,
  StorageService,
  ToolExecution,
  UsageRecord,
} from "../../sdk/mod.ts";

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-sqlite";

import { definePlugin } from "../../sdk/mod.ts";
import * as schema from "./schema.ts";

const migration = `
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), parent_id TEXT REFERENCES entries(id), data TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS entries_session ON entries(session_id, created_at);
CREATE TABLE IF NOT EXISTS executions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS executions_session ON executions(session_id);
CREATE TABLE IF NOT EXISTS usage (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, data TEXT NOT NULL);
PRAGMA user_version=1;
`;

export default definePlugin({
  id: "fathom:storage",
  apiVersion: 1,
  backend: {
    requires: ["workspace", "events"],
    provides: ["storage"],
    activate(ctx) {
      const workspace = ctx.get("workspace");
      mkdirSync(workspace.dataDir, { recursive: true, mode: 0o700 });
      const sqlite = new DatabaseSync(join(workspace.dataDir, "sessions.db"));
      sqlite.exec(
        "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
      );
      const version = sqlite.prepare("PRAGMA user_version").get()
        ?.user_version as number;
      if (version > 1) {
        sqlite.close();
        throw new Error("Database belongs to a newer version of Fathom");
      }
      if (version < 1) {
        sqlite.exec("BEGIN IMMEDIATE");
        try {
          sqlite.exec(migration);
          sqlite.exec("COMMIT");
        } catch (error) {
          sqlite.exec("ROLLBACK");
          sqlite.close();
          throw error;
        }
      }
      const db = drizzle({ client: sqlite });
      let transactionDepth = 0;
      const storage: StorageService = {
        listSessions: () =>
          db.select().from(schema.sessions).orderBy(
            desc(schema.sessions.updatedAt),
          ).all().map((row) => JSON.parse(row.data)),
        createSession(input = {}) {
          const now = Date.now();
          const session: Session = {
            id: crypto.randomUUID(),
            title: "New session",
            parentSessionId: null,
            activeLeafId: null,
            provider: "",
            model: "",
            thinking: "low",
            status: "idle",
            pinned: false,
            archived: false,
            toolPolicy: "default",
            createdAt: now,
            updatedAt: now,
            ...input,
          };
          db.insert(schema.sessions).values({
            id: session.id,
            data: JSON.stringify(session),
            updatedAt: now,
          }).run();
          return session;
        },
        getSession(id) {
          const row = db.select().from(schema.sessions).where(
            eq(schema.sessions.id, id),
          ).get();
          if (!row) throw new Error("Session not found");
          return JSON.parse(row.data);
        },
        updateSession(id, changes) {
          const session = {
            ...storage.getSession(id),
            ...changes,
            id,
            updatedAt: Date.now(),
          };
          db.update(schema.sessions).set({
            data: JSON.stringify(session),
            updatedAt: session.updatedAt,
          }).where(eq(schema.sessions.id, id)).run();
          return session;
        },
        entries(sessionId, leafId) {
          const leaf = leafId === undefined
            ? storage.getSession(sessionId).activeLeafId
            : leafId;
          if (!leaf) return [];
          const rows = sqlite.prepare(
            `WITH RECURSIVE branch(id, parent_id, data, depth) AS (
            SELECT id, parent_id, data, 0 FROM entries WHERE id=? AND session_id=?
            UNION ALL SELECT e.id, e.parent_id, e.data, b.depth+1 FROM entries e JOIN branch b ON e.id=b.parent_id WHERE e.session_id=?
          ) SELECT data FROM branch ORDER BY depth DESC`,
          ).all(leaf, sessionId, sessionId);
          return rows.map((row) => JSON.parse(row.data as string));
        },
        allEntries: (sessionId) =>
          db.select().from(schema.entries).where(
            eq(schema.entries.sessionId, sessionId),
          ).all().map((row) => JSON.parse(row.data)),
        append(sessionId, input) {
          return storage.transaction(() => {
            const entry: Entry = {
              ...input,
              id: crypto.randomUUID(),
              sessionId,
              parentId: storage.getSession(sessionId).activeLeafId,
              createdAt: Date.now(),
            };
            db.insert(schema.entries).values({
              id: entry.id,
              sessionId,
              parentId: entry.parentId,
              data: JSON.stringify(entry),
              createdAt: entry.createdAt,
            }).run();
            storage.updateSession(sessionId, { activeLeafId: entry.id });
            return entry;
          });
        },
        updateEntry(id, changes) {
          const row = db.select().from(schema.entries).where(
            eq(schema.entries.id, id),
          ).get();
          if (!row) throw new Error("Entry not found");
          db.update(schema.entries).set({
            data: JSON.stringify({ ...JSON.parse(row.data), ...changes }),
          }).where(eq(schema.entries.id, id)).run();
        },
        saveExecution(execution) {
          const value = {
            id: execution.id,
            sessionId: execution.sessionId,
            data: JSON.stringify(execution),
          };
          db.insert(schema.executions).values(value).onConflictDoUpdate({
            target: schema.executions.id,
            set: { data: value.data },
          }).run();
        },
        executions: (sessionId) =>
          db.select().from(schema.executions).where(
            eq(schema.executions.sessionId, sessionId),
          ).all().map((row) => JSON.parse(row.data) as ToolExecution),
        recordUsage: (record) => {
          db.insert(schema.usage).values({
            id: record.id,
            data: JSON.stringify(record),
          }).run();
          ctx.get("events").publish({
            type: "usage",
            sessionId: record.sessionId,
          });
        },
        usage: () =>
          db.select().from(schema.usage).all().map((row) =>
            JSON.parse(row.data) as UsageRecord
          ),
        setting(key, fallback) {
          const row = db.select().from(schema.settings).where(
            eq(schema.settings.key, key),
          ).get();
          return row ? JSON.parse(row.data) : fallback;
        },
        setSetting(key, value) {
          const data = JSON.stringify(value);
          db.insert(schema.settings).values({ key, data }).onConflictDoUpdate({
            target: schema.settings.key,
            set: { data },
          }).run();
        },
        transaction(action) {
          if (transactionDepth) return action();
          sqlite.exec("BEGIN IMMEDIATE");
          transactionDepth++;
          try {
            const result = action();
            sqlite.exec("COMMIT");
            return result;
          } catch (error) {
            sqlite.exec("ROLLBACK");
            throw error;
          } finally {
            transactionDepth--;
          }
        },
      };
      ctx.provide("storage", storage);
      ctx.effect(() => () => {
        sqlite.close();
      });
    },
  },
});
