// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createDb, getSqlite } from "../db/client.js";
import { migrate } from "../db/migrate.js";
import { seed } from "../db/seed.js";

const tempDbs: string[] = [];

const createTestApp = () => {
  const dbPath = path.join(
    os.tmpdir(),
    `excalidraw-test-${Date.now()}-${Math.random()}.db`,
  );
  tempDbs.push(dbPath);
  migrate(dbPath);
  seed(dbPath);
  const db = createDb(dbPath);
  return { app: createApp(db), db };
};

afterEach(() => {
  for (const dbPath of tempDbs.splice(0)) {
    fs.rmSync(dbPath, { force: true });
  }
});

describe("GET /health", () => {
  it("returns service status and migration version", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      migrationVersion: "0001_init",
    });
  });
});

describe("GET /live", () => {
  it("returns ok without a migration version", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/live");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.body).not.toHaveProperty("migrationVersion");
  });

  it("stays healthy after the database connection is closed", async () => {
    const { app, db } = createTestApp();
    (getSqlite(db) as { close: () => void }).close();

    const live = await request(app).get("/live");
    expect(live.status).toBe(200);
    expect(live.body).toEqual({ status: "ok" });

    const health = await request(app).get("/health");
    expect(health.status).not.toBe(200);
  });
});
