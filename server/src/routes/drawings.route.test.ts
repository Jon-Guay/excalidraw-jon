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
  it("archives and restores drawings without losing scene data", async () => {
    const app = createTestApp();

    const scene = {
      type: "excalidraw",
      version: 2,
      elements: [{ id: "el-1", type: "rectangle" }],
      appState: { viewModeEnabled: false },
    };

    const createResponse = await request(app)
      .post("/drawings")
      .send({ ownerId: "user-alice", title: "Test drawing", scene });

    expect(createResponse.status).toBe(201);
    const drawingId = createResponse.body.drawing.id;
    expect(createResponse.body.drawing.archivedAt).toBeNull();

    const getResponse = await request(app).get(`/drawings/${drawingId}`);
    expect(getResponse.body.drawing.title).toBe("Test drawing");
    expect(getResponse.body.drawing.scene).toEqual(scene);

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

    const archiveResponse = await request(app).post(
      `/drawings/${drawingId}/archive`,
    );
    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body.drawing.archivedAt).toBeTruthy();

    const defaultListAfterArchive = await request(app).get(
      "/drawings?ownerId=user-alice",
    );
    expect(
      defaultListAfterArchive.body.drawings.some(
        (d: { id: string }) => d.id === drawingId,
      ),
    ).toBe(false);

    const includeArchivedList = await request(app).get(
      "/drawings?ownerId=user-alice&includeArchived=true",
    );
    expect(
      includeArchivedList.body.drawings.some(
        (d: { id: string }) => d.id === drawingId,
      ),
    ).toBe(true);

    const restoreResponse = await request(app).post(
      `/drawings/${drawingId}/restore`,
    );
    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.drawing.archivedAt).toBeNull();

    const listAfterRestore = await request(app).get(
      "/drawings?ownerId=user-alice",
    );
    const restoredDrawing = listAfterRestore.body.drawings.find(
      (d: { id: string }) => d.id === drawingId,
    );
    expect(restoredDrawing).toBeTruthy();
    expect(restoredDrawing.scene).toEqual(scene);
  });

  it("keeps scene JSON after archive and restore across restarts", async () => {
    const dbPath = path.join(
      os.tmpdir(),
      `excalidraw-test-restart-${Date.now()}-${Math.random()}.db`,
    );
    tempDbs.push(dbPath);
    migrate(dbPath);
    seed(dbPath);
    const app = createApp(createDb(dbPath));

    const scene = {
      type: "excalidraw",
      version: 2,
      elements: [{ id: "el-restart", type: "ellipse" }],
      appState: { gridSize: 20 },
    };

    const createResponse = await request(app)
      .post("/drawings")
      .send({ ownerId: "user-alice", title: "Restart drawing", scene });
    const drawingId = createResponse.body.drawing.id;

    await request(app).post(`/drawings/${drawingId}/archive`).expect(200);
    await request(app).post(`/drawings/${drawingId}/restore`).expect(200);

    const restartedApp = createApp(createDb(dbPath));
    const getResponse = await request(restartedApp).get(
      `/drawings/${drawingId}`,
    );
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.drawing.scene).toEqual(scene);
  });
});
