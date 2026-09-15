// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createDb } from "../db/client.js";
import { migrate } from "../db/migrate.js";
import { seed } from "../db/seed.js";

import { createHealthRouter } from "./health.route.js";

import type { DbClient } from "../db/client.js";

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
  return createApp(db);
};

afterEach(() => {
  for (const dbPath of tempDbs.splice(0)) {
    fs.rmSync(dbPath, { force: true });
  }
});

describe("GET /health", () => {
  it("returns service status and migration version", async () => {
    const app = createTestApp();
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      migrationVersion: "0001_init",
    });
  });
});

describe("GET /livez", () => {
  it("returns ok without migration version", async () => {
    const app = createTestApp();
    const response = await request(app).get("/livez");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("does not query the database", async () => {
    const throwingDb = new Proxy({} as DbClient, {
      get() {
        throw new Error("database must not be queried");
      },
    });
    const app = express();
    app.use(createHealthRouter(throwingDb));

    const response = await request(app).get("/livez");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
