import { createRequire } from "node:module";

import { drizzle as drizzleBetter } from "drizzle-orm/better-sqlite3";

import { migrationMeta } from "./migrationMeta.js";
import { schema as domainSchema } from "./schema.js";

const require = createRequire(import.meta.url);

const schema = { ...domainSchema, migrationMeta };

type SqlValue = string | number | bigint | null | Uint8Array;

type NodeStatementSync = {
  run: (...params: SqlValue[]) => unknown;
  get: (...params: SqlValue[]) => unknown;
  all: (...params: SqlValue[]) => unknown[];
};

type NodeDatabaseSync = {
  exec: (sql: string) => void;
  prepare: (sql: string) => NodeStatementSync;
};

type PreparedStatement = {
  run: (...params: SqlValue[]) => unknown;
  get: (...params: SqlValue[]) => unknown;
  all: (...params: SqlValue[]) => unknown[];
  raw: () => PreparedStatement;
};

export type SqliteClient = {
  exec: (sql: string) => void;
  prepare: (sql: string) => PreparedStatement;
  transaction?: <T extends (...args: never[]) => unknown>(
    fn: T,
  ) => T & {
    deferred: T;
    immediate: T;
    exclusive: T;
  };
};

class NodeStatement implements PreparedStatement {
  constructor(private readonly stmt: NodeStatementSync) {}

  run(...params: SqlValue[]) {
    return this.stmt.run(...params);
  }

  get(...params: SqlValue[]) {
    return this.stmt.get(...params);
  }

  all(...params: SqlValue[]) {
    return this.stmt.all(...params);
  }

  raw() {
    const stmt = this.stmt;
    const rawStatement: PreparedStatement = {
      run: (...params: SqlValue[]) => stmt.run(...params),
      get: (...params: SqlValue[]) => {
        const row = stmt.get(...params);
        if (!row) {
          return undefined;
        }
        return Object.values(row as Record<string, SqlValue>);
      },
      all: (...params: SqlValue[]) =>
        stmt
          .all(...params)
          .map((row) => Object.values(row as Record<string, SqlValue>)),
      raw: () => rawStatement,
    };
    return rawStatement;
  }
}

class NodeDatabase implements SqliteClient {
  constructor(private readonly db: NodeDatabaseSync) {}

  exec(sql: string) {
    this.db.exec(sql);
  }

  prepare(sql: string) {
    return new NodeStatement(this.db.prepare(sql));
  }

  transaction<T extends (...args: never[]) => unknown>(
    fn: T,
  ): T & { deferred: T; immediate: T; exclusive: T } {
    const wrapped = ((...args: Parameters<T>) => {
      this.db.exec("BEGIN");
      try {
        const result = fn(...args);
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }) as T;

    return Object.assign(wrapped, {
      deferred: wrapped,
      immediate: wrapped,
      exclusive: wrapped,
    });
  }
}

export const openSqlite = (filePath: string): SqliteClient => {
  try {
    const BetterSqlite3 =
      require("better-sqlite3") as typeof import("better-sqlite3");
    const db = new BetterSqlite3(filePath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    return db as unknown as SqliteClient;
  } catch (betterSqliteError) {
    try {
      const { DatabaseSync } =
        require("node:sqlite") as typeof import("node:sqlite");
      const db = new DatabaseSync(filePath);
      db.exec("PRAGMA journal_mode = WAL");
      db.exec("PRAGMA foreign_keys = ON");
      return new NodeDatabase(db);
    } catch {
      throw betterSqliteError;
    }
  }
};

export const DEFAULT_DB_PATH =
  process.env.DB_FILE_NAME ?? "./data/excalidraw.db";

export type DbClient = ReturnType<typeof createDb>;

export const createDb = (filePath: string = DEFAULT_DB_PATH) => {
  const client = openSqlite(filePath);
  return drizzleBetter(client as import("better-sqlite3").Database, { schema });
};

export const getSqlite = (db: DbClient): SqliteClient =>
  (db as unknown as { session: { client: SqliteClient } }).session.client;

export const getAppliedMigrationVersion = (db: DbClient): string => {
  const row = getSqlite(db)
    .prepare("SELECT value FROM __migration_meta WHERE key = ?")
    .get("migration_version") as { value: string } | undefined;
  return row?.value ?? "none";
};

export const setAppliedMigrationVersion = (
  db: DbClient,
  version: string,
): void => {
  getSqlite(db)
    .prepare(
      `INSERT INTO __migration_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run("migration_version", version);
};
