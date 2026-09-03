// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createDb } from "../db/client.js";
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
  return createApp(createDb(dbPath));
};

afterEach(() => {
  for (const dbPath of tempDbs.splice(0)) {
    fs.rmSync(dbPath, { force: true });
  }
});

describe("GET /workspace/summary", () => {
  it("returns zero drawings and seeded user count when the workspace is empty", async () => {
    const app = createTestApp();
    const response = await request(app).get("/workspace/summary");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      drawingCount: 0,
      userCount: 3,
      latestUpdatedAt: null,
    });
  });

  it("returns drawing count, user count, and latest update timestamp", async () => {
    const app = createTestApp();

    const firstCreate = await request(app)
      .post("/drawings")
      .send({ ownerId: "user-alice", title: "First drawing" });
    expect(firstCreate.status).toBe(201);

    const secondCreate = await request(app)
      .post("/drawings")
      .send({ ownerId: "user-bob", title: "Second drawing" });
    expect(secondCreate.status).toBe(201);

    const patchResponse = await request(app)
      .patch(`/drawings/${firstCreate.body.drawing.id}`)
      .send({ title: "First drawing updated" });
    expect(patchResponse.status).toBe(200);

    const response = await request(app).get("/workspace/summary");

    expect(response.status).toBe(200);
    expect(response.body.drawingCount).toBe(2);
    expect(response.body.userCount).toBe(3);
    expect(response.body.latestUpdatedAt).toBe(
      patchResponse.body.drawing.updatedAt,
    );
    expect(new Date(response.body.latestUpdatedAt).toISOString()).toBe(
      response.body.latestUpdatedAt,
    );
  });
});
