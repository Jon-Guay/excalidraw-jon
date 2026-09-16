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

const createTestApp = (dbPath?: string) => {
  const resolvedPath =
    dbPath ??
    path.join(
      os.tmpdir(),
      `excalidraw-test-${Date.now()}-${Math.random()}.db`,
    );
  if (!dbPath) {
    tempDbs.push(resolvedPath);
  }
  migrate(resolvedPath);
  seed(resolvedPath);
  return { app: createApp(createDb(resolvedPath)), dbPath: resolvedPath };
};

afterEach(() => {
  for (const dbPath of tempDbs.splice(0)) {
    fs.rmSync(dbPath, { force: true });
  }
});

const scenePayload = {
  type: "excalidraw",
  version: 2,
  elements: [{ id: "el-1", type: "rectangle" }],
  appState: {},
};

describe("drawings routes", () => {
  it("creates, reads, updates, and deletes a drawing", async () => {
    const { app } = createTestApp();

    const createResponse = await request(app)
      .post("/drawings")
      .send({ ownerId: "user-alice", title: "Test drawing" });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.drawing.archivedAt).toBeNull();
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

  it("archives and restores a drawing while preserving scene data across restarts", async () => {
    const { app: app1, dbPath } = createTestApp();

    const createResponse = await request(app1)
      .post("/drawings")
      .send({
        ownerId: "user-alice",
        title: "Archive me",
        scene: scenePayload,
      });
    const drawingId = createResponse.body.drawing.id;

    const archiveResponse = await request(app1).post(
      `/drawings/${drawingId}/archive`,
    );
    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body.drawing.archivedAt).not.toBeNull();

    const defaultList = await request(app1).get(
      "/drawings?ownerId=user-alice",
    );
    expect(
      defaultList.body.drawings.some(
        (d: { id: string }) => d.id === drawingId,
      ),
    ).toBe(false);

    const archivedList = await request(app1).get(
      "/drawings?ownerId=user-alice&includeArchived=true",
    );
    const archivedRow = archivedList.body.drawings.find(
      (d: { id: string }) => d.id === drawingId,
    );
    expect(archivedRow?.archivedAt).not.toBeNull();

    const getWhileArchived = await request(app1).get(`/drawings/${drawingId}`);
    expect(getWhileArchived.status).toBe(200);
    expect(getWhileArchived.body.drawing.scene).toEqual(scenePayload);

    const { app: app2 } = createTestApp(dbPath);
    const getAfterRestart = await request(app2).get(`/drawings/${drawingId}`);
    expect(getAfterRestart.body.drawing.scene).toEqual(scenePayload);

    const restoreResponse = await request(app2).post(
      `/drawings/${drawingId}/restore`,
    );
    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.drawing.archivedAt).toBeNull();

    const listAfterRestore = await request(app2).get(
      "/drawings?ownerId=user-alice",
    );
    expect(
      listAfterRestore.body.drawings.some(
        (d: { id: string }) => d.id === drawingId,
      ),
    ).toBe(true);

    const { app: app3 } = createTestApp(dbPath);
    const getAfterSecondRestart = await request(app3).get(
      `/drawings/${drawingId}`,
    );
    expect(getAfterSecondRestart.body.drawing.scene).toEqual(scenePayload);
    expect(getAfterSecondRestart.body.drawing.archivedAt).toBeNull();
  });

  it("returns 404 when archive or restore targets a missing drawing", async () => {
    const { app } = createTestApp();

    const archiveMissing = await request(app).post(
      "/drawings/missing-id/archive",
    );
    expect(archiveMissing.status).toBe(404);

    const restoreMissing = await request(app).post(
      "/drawings/missing-id/restore",
    );
    expect(restoreMissing.status).toBe(404);
  });
});
