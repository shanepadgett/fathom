import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import { eq } from "drizzle-orm";
import { conversations } from "./schema.ts";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ModelMessage } from "../contracts/model.ts";
import type { SessionSnapshot } from "../contracts/session.ts";

export class Storage {
  readonly sqlite: DatabaseSync;
  readonly db;
  constructor(readonly workspace: string) {
    const path = Deno.env.get("FATHOM_DB") ?? resolve(
      Deno.env.get("HOME") ?? Deno.cwd(),
      ".fathom/prototype-integration/sessions.db",
    );
    mkdirSync(dirname(path), { recursive: true });
    this.sqlite = new DatabaseSync(path);
    this.sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db = drizzle({ client: this.sqlite });
  }
  load() {
    const row = this.db.select().from(conversations)
      .where(eq(conversations.workspace, this.workspace)).get();
    return row
      ? {
        snapshot: JSON.parse(row.snapshot) as SessionSnapshot,
        history: JSON.parse(row.history) as ModelMessage[],
      }
      : undefined;
  }
  save(snapshot: SessionSnapshot, history: ModelMessage[]) {
    const value = {
      workspace: this.workspace,
      snapshot: JSON.stringify(snapshot),
      history: JSON.stringify(history),
    };
    this.db.insert(conversations).values(value).onConflictDoUpdate({
      target: conversations.workspace,
      set: value,
    }).run();
  }
  close() {
    this.sqlite.close();
  }
}
