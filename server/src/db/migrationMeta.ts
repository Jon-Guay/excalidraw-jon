import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const migrationMeta = sqliteTable("__migration_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
