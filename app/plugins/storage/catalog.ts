import type { Project, Session } from "../../sdk/session.ts";

import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Read saved session metadata without activating a project's plugin environment. */
export function savedSessions(home: string, projects: Project[]) {
  const items: { project: Project; session: Session }[] = [];
  const unavailable: string[] = [];
  for (const project of projects) {
    const path = join(home, "projects", project.id, "sessions.db");
    if (!existsSync(path)) continue;
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(path, { readOnly: true });
      const version = Number(database.prepare("PRAGMA user_version").get()?.user_version);
      if (version !== 1) {
        throw new Error("Unsupported session database version");
      }
      const rows = database.prepare("SELECT data FROM sessions ORDER BY updated_at DESC").all();
      for (const row of rows) {
        const session = JSON.parse(String(row.data)) as Session;
        if (!session.archived) items.push({ project, session });
      }
    } catch {
      unavailable.push(project.name);
    } finally {
      database?.close();
    }
  }
  items.sort((a, b) => b.session.updatedAt - a.session.updatedAt);
  return { items, unavailable };
}
