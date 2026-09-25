import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const drawings = sqliteTable("drawings", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  scene: text("scene").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
});

export type DbUser = typeof users.$inferSelect;
export type DbDrawing = typeof drawings.$inferSelect;

export const schema = { users, drawings };
