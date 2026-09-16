// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createDb, getAppliedMigrationVersion, getSqlite } from "./client.js";
import { migrate } from "./migrate.js";

describe("migrate", () => {
  it("is idempotent", () => {
    const dbPath = path.join(
      os.tmpdir(),
      `excalidraw-migrate-${Date.now()}.db`,
    );

    const first = migrate(dbPath);
    const second = migrate(dbPath);

    expect(first).toBe("0002_archive_drawings");
    expect(second).toBe("0002_archive_drawings");
    expect(getAppliedMigrationVersion(createDb(dbPath))).toBe(
      "0002_archive_drawings",
    );

    fs.rmSync(dbPath, { force: true });
  });

  it("adds archived_at to a legacy 0001 database without changing row data", () => {
    const dbPath = path.join(
      os.tmpdir(),
      `excalidraw-migrate-legacy-${Date.now()}.db`,
    );
    const sqlite = getSqlite(createDb(dbPath));

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS __migration_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE drawings (
        id TEXT PRIMARY KEY NOT NULL,
        owner_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        scene TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    sqlite
      .prepare(
        `INSERT INTO __migration_meta (key, value) VALUES (?, ?)`,
      )
      .run("migration_version", "0001_init");
    sqlite
      .prepare(
        `INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)`,
      )
      .run("user-alice", "Alice", 1);
    const scene = JSON.stringify({ type: "excalidraw", elements: [{ id: "a" }] });
    sqlite
      .prepare(
        `INSERT INTO drawings (id, owner_id, title, scene, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("drawing-1", "user-alice", "Legacy", scene, 2, 3);

    expect(migrate(dbPath)).toBe("0002_archive_drawings");

    const row = sqlite
      .prepare(
        `SELECT title, scene, archived_at FROM drawings WHERE id = ?`,
      )
      .get("drawing-1") as {
      title: string;
      scene: string;
      archived_at: number | null;
    };

    expect(row.title).toBe("Legacy");
    expect(row.scene).toBe(scene);
    expect(row.archived_at).toBeNull();

    fs.rmSync(dbPath, { force: true });
  });
});
