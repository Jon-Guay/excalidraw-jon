import fs from "node:fs";
import path from "node:path";

import {
  createDb,
  getAppliedMigrationVersion,
  setAppliedMigrationVersion,
  getSqlite,
} from "./client.js";

const MIGRATION_META_TABLE = `
  CREATE TABLE IF NOT EXISTS __migration_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )
`;

const MIGRATIONS: Array<{ version: string; sql: string }> = [
  {
    version: "0001_init",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS drawings (
        id TEXT PRIMARY KEY NOT NULL,
        owner_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        scene TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: "0002_drawings_archive",
    sql: `
      ALTER TABLE drawings ADD COLUMN archived_at INTEGER;
    `,
  },
];

export const migrate = (dbPath: string): string => {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = createDb(dbPath);
  const sqlite = getSqlite(db);

  sqlite.exec(MIGRATION_META_TABLE);

  const targetVersion = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? "none";
  const current = getAppliedMigrationVersion(db);
  if (current === targetVersion) {
    return current;
  }

  for (const migration of MIGRATIONS) {
    if (getAppliedMigrationVersion(db) === migration.version) {
      continue;
    }
    sqlite.exec("BEGIN");
    try {
      sqlite.exec(migration.sql);
      setAppliedMigrationVersion(db, migration.version);
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  return getAppliedMigrationVersion(db);
};

export const runMigrations = (): string => {
  const dbPath = process.env.DB_FILE_NAME ?? "./data/excalidraw.db";
  return migrate(dbPath);
};

if (process.argv[1]?.endsWith("migrate.ts")) {
  const version = runMigrations();
  process.stdout.write(`migrations applied: ${version}\n`);
}
