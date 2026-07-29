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

const createTestApp = (): {
  app: ReturnType<typeof createApp>;
  dbPath: string;
} => {
  const dbPath = path.join(
    os.tmpdir(),
    `excalidraw-test-${Date.now()}-${Math.random()}.db`,
  );
  tempDbs.push(dbPath);
  migrate(dbPath);
  seed(dbPath);
  return { app: createApp(createDb(dbPath)), dbPath };
};

afterEach(() => {
  for (const dbPath of tempDbs.splice(0)) {
    fs.rmSync(dbPath, { force: true });
  }
});

describe("drawings routes", () => {
  it("creates, reads, updates, and deletes a drawing", async () => {
    const { app } = createTestApp();

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

  it("archives/restores drawings and preserves scene across app restarts", async () => {
    const { app, dbPath } = createTestApp();

    const scene = {
      type: "excalidraw",
      version: 2,
      elements: [],
      appState: {},
    };

    const createResponse = await request(app)
      .post("/drawings")
      .send({ ownerId: "user-alice", title: "Test drawing", scene });

    expect(createResponse.status).toBe(201);
    const drawingId = createResponse.body.drawing.id;

    const archiveResponse = await request(app).patch(
      `/drawings/${drawingId}/archive`,
    );
    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body.drawing.archivedAt).not.toBeNull();

    const listDefault = await request(app).get("/drawings?ownerId=user-alice");
    expect(
      listDefault.body.drawings.some((d: { id: string }) => d.id === drawingId),
    ).toBe(false);

    const listIncludeArchived = await request(app).get(
      "/drawings?ownerId=user-alice&includeArchived=true",
    );
    expect(
      listIncludeArchived.body.drawings.some(
        (d: { id: string }) => d.id === drawingId,
      ),
    ).toBe(true);

    const restoreResponse = await request(app).patch(
      `/drawings/${drawingId}/restore`,
    );
    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.drawing.archivedAt).toBeNull();

    // Simulate a service restart by rebuilding the express app with the same DB file.
    const restartedApp = createApp(createDb(dbPath));

    const getAfterRestart = await request(restartedApp).get(
      `/drawings/${drawingId}`,
    );
    expect(getAfterRestart.status).toBe(200);
    expect(getAfterRestart.body.drawing.scene).toEqual(scene);

    const listAfterRestart = await request(restartedApp).get(
      "/drawings?ownerId=user-alice",
    );
    expect(
      listAfterRestart.body.drawings.some(
        (d: { id: string }) => d.id === drawingId,
      ),
    ).toBe(true);
  });
});
