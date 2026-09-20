import { DatabaseSync } from "node:sqlite";
import type { Scope, StorageNamespace } from "@fathom/sdk";

export function openSqliteStorage(home: string, scope: Scope) {
  const db = new DatabaseSync(`${home}/fathom.db`);
  scope.defer(() => db.close());

  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS plugin_values(namespace TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(namespace,key))",
  );

  const get = db.prepare(
    "SELECT value FROM plugin_values WHERE namespace=? AND key=?",
  );

  const put = db.prepare(
    "INSERT INTO plugin_values(namespace,key,value) VALUES(?,?,?) ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value",
  );

  const remove = db.prepare(
    "DELETE FROM plugin_values WHERE namespace=? AND key=?",
  );

  return ({ id }: Scope): StorageNamespace => ({
    get(key) {
      const row = get.get(id, key);

      if (!row) {
        return undefined;
      }

      if (typeof row.value !== "string") {
        throw new Error("Stored plugin value must be JSON text");
      }

      return JSON.parse(row.value);
    },

    set(key, value) {
      put.run(id, key, JSON.stringify(value));
    },

    delete(key) {
      remove.run(id, key);
    },
  });
}
