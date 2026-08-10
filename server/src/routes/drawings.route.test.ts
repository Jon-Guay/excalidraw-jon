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

describe("drawings routes", () => {
  it("creates, reads, updates, and deletes a drawing", async () => {
    const app = createTestApp();

    const createResponse = await request(app)
      .post("/drawings")
      .send({ ownerId: "user-alice", title: "Test drawing" });

    expect(createResponse.status).toBe(201);
    const drawingId = createResponse.body.drawing.id;

    const getResponse = await request(app).get(`/drawings/${drawingId}`);
    expect(getResponse.body.drawing.title).toBe("Test drawing");

    const patchResponse = await request(app)
      .patch(`/drawings/${drawingId}`)
      .send({ title: "Renamed" });
    expect(patchResponse.body.drawing.title).toBe("Renamed");

    const listResponse = await request(app).get("/drawings?ownerId=user-alice");
    expect(
      listResponse.body.drawings.some(
        (d: { id: string }) => d.id === drawingId,
      ),
    ).toBe(true);

    const deleteResponse = await request(app).delete(`/drawings/${drawingId}`);
    expect(deleteResponse.body.id).toBe(drawingId);
  });
});

describe("POST /drawings/:id/duplicate", () => {
  const scene = {
    type: "excalidraw",
    version: 2,
    elements: [{ id: "el-1", type: "rectangle" }],
    appState: { viewBackgroundColor: "#ffffff" },
  };

  it("copies the scene into a new drawing owned by the same user", async () => {
    const app = createTestApp();

    const createResponse = await request(app)
      .post("/drawings")
      .send({ ownerId: "user-alice", title: "Original", scene });
    expect(createResponse.status).toBe(201);
    const originalId = createResponse.body.drawing.id;

    const duplicateResponse = await request(app).post(
      `/drawings/${originalId}/duplicate`,
    );

    expect(duplicateResponse.status).toBe(201);
    expect(duplicateResponse.body.drawing.id).not.toBe(originalId);
    expect(duplicateResponse.body.drawing.title).toBe("Original (copy)");
    expect(duplicateResponse.body.drawing.ownerId).toBe("user-alice");
    expect(duplicateResponse.body.drawing.scene).toEqual(scene);
  });

  it("leaves the original drawing unchanged", async () => {
    const app = createTestApp();

    const createResponse = await request(app)
      .post("/drawings")
      .send({ ownerId: "user-alice", title: "Original", scene });
    const originalId = createResponse.body.drawing.id;
    const originalBefore = createResponse.body.drawing;

    await request(app).post(`/drawings/${originalId}/duplicate`);

    const getResponse = await request(app).get(`/drawings/${originalId}`);
    expect(getResponse.body.drawing.title).toBe(originalBefore.title);
    expect(getResponse.body.drawing.scene).toEqual(originalBefore.scene);
    expect(getResponse.body.drawing.updatedAt).toBe(originalBefore.updatedAt);
  });

  it("returns 404 for an unknown drawing id", async () => {
    const app = createTestApp();

    const duplicateResponse = await request(app).post(
      "/drawings/does-not-exist/duplicate",
    );

    expect(duplicateResponse.status).toBe(404);
  });
});
