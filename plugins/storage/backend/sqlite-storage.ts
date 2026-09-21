import { DatabaseSync } from "node:sqlite";
import type { Scope, StorageNamespace } from "@fathom/sdk";

const MAX_VALUE_TEXT_LENGTH = 1_000_000;

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

      try {
        return JSON.parse(row.value);
      } catch {
        throw new Error(`Stored plugin value for "${key}" is not valid JSON`);
      }
    },

    set(key, value) {
      const text = JSON.stringify(value);

      if (text.length > MAX_VALUE_TEXT_LENGTH) {
        throw new Error(
          `Plugin value for "${key}" exceeds ${MAX_VALUE_TEXT_LENGTH} characters`,
        );
      }

      put.run(id, key, text);
    },

    delete(key) {
      remove.run(id, key);
    },
  });
}
