import type { Project } from "../sdk/mod.ts";

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { atomicWrite, readJson } from "./files.ts";

export class ProjectRegistry {
  private db: DatabaseSync;
  private trust: string[] = [];
  private trustWriting = Promise.resolve();

  constructor(readonly home: string) {
    mkdirSync(home, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(home, "global.db"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, path TEXT UNIQUE NOT NULL, name TEXT NOT NULL, last_opened_at INTEGER NOT NULL);",
    );
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS trust_reviews (project_id TEXT PRIMARY KEY NOT NULL);",
    );
  }

  async initialize() {
    const trust = await readJson<unknown>(
      join(this.home, "trusted_roots.json"),
      [],
    );
    if (!Array.isArray(trust) || !trust.every((v) => typeof v === "string")) {
      throw new Error("Invalid trusted_roots.json");
    }
    this.trust = trust;
  }

  list(): Project[] {
    return this.db.prepare(
      "SELECT projects.*, trust_reviews.project_id AS reviewed FROM projects LEFT JOIN trust_reviews ON trust_reviews.project_id = projects.id ORDER BY last_opened_at DESC",
    ).all().map((row) => ({
      id: String(row.id),
      path: String(row.path),
      name: String(row.name),
      trusted: this.trust.includes(String(row.path)),
      trustReviewed: row.reviewed !== null ||
        this.trust.includes(String(row.path)),
      lastOpenedAt: Number(row.last_opened_at),
    }));
  }

  async open(path: string) {
    const canonical = await Deno.realPath(path);
    if (!(await Deno.stat(canonical)).isDirectory) {
      throw new Error("Project must be a directory");
    }
    const id = createHash("sha256").update(canonical).digest("hex").slice(
      0,
      24,
    );
    this.db.prepare(
      "INSERT INTO projects (id,path,name,last_opened_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_opened_at=excluded.last_opened_at",
    ).run(id, canonical, basename(canonical), Date.now());
    return this.list().find((p) => p.id === id)!;
  }

  setTrust(id: string, trusted: boolean) {
    const writing = this.trustWriting.then(() => this.writeTrust(id, trusted));
    this.trustWriting = writing.catch(() => {});
    return writing;
  }

  private async writeTrust(id: string, trusted: boolean) {
    const project = this.list().find((p) => p.id === id);
    if (!project) throw new Error("Project not found");
    if (project.trusted !== trusted) {
      const next = this.trust.filter((root) => root !== project.path);
      if (trusted) next.push(project.path);
      await atomicWrite(
        join(this.home, "trusted_roots.json"),
        JSON.stringify(next, null, 2),
      );
      this.trust = next;
    }
    this.db.prepare(
      "INSERT OR IGNORE INTO trust_reviews (project_id) VALUES (?)",
    ).run(id);
  }

  async close() {
    await this.trustWriting;
    this.db.close();
  }
}
