import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const conversations = sqliteTable("conversations", {
  workspace: text().primaryKey(),
  snapshot: text().notNull(),
  history: text().notNull(),
});
