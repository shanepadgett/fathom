import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text().primaryKey(),
  data: text().notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const entries = sqliteTable("entries", {
  id: text().primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  parentId: text("parent_id"),
  data: text().notNull(),
  createdAt: integer("created_at").notNull(),
});

export const executions = sqliteTable("executions", {
  id: text().primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  data: text().notNull(),
});

export const usage = sqliteTable("usage", {
  id: text().primaryKey(),
  data: text().notNull(),
});

export const settings = sqliteTable("settings", {
  key: text().primaryKey(),
  data: text().notNull(),
});
