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

import type { DbClient } from "../db/client.js";

const tempDbs: string[] = [];

const createTestDbPath = () => {
  const dbPath = path.join(
    os.tmpdir(),
    `excalidraw-test-${Date.now()}-${Math.random()}.db`,
  );
  tempDbs.push(dbPath);
  migrate(dbPath);
  seed(dbPath);
  return dbPath;
};

const createTestApp = () => createApp(createDb(createTestDbPath()));

const closeDb = (db: DbClient) => {
  const sqlite = getSqlite(db) as { close?: () => void };
  sqlite.close?.();
};

afterEach(() => {
  for (const dbPath of tempDbs.splice(0)) {
    fs.rmSync(dbPath, { force: true });
    for (const suffix of ["-wal", "-shm"]) {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    }
  }
});

describe("drawings routes", () => {
  it("creates, reads, updates, and deletes a drawing", async () => {
    const app = createTestApp();

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

  it("archives a drawing out of the default list and restores it", async () => {
    const app = createTestApp();
    const scene = {
      type: "excalidraw",
      version: 2,
      elements: [{ id: "rect-1", type: "rectangle" }],
      appState: { viewBackgroundColor: "#fff" },
    };

    const createResponse = await request(app)
      .post("/drawings")
      .send({ ownerId: "user-alice", title: "Archive me", scene });
    expect(createResponse.status).toBe(201);
    const drawingId = createResponse.body.drawing.id;

    const archiveResponse = await request(app).post(
      `/drawings/${drawingId}/archive`,
    );
    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body.drawing.archivedAt).toEqual(expect.any(String));
    expect(archiveResponse.body.drawing.scene).toEqual(scene);

    const defaultList = await request(app).get("/drawings?ownerId=user-alice");
    expect(
      defaultList.body.drawings.some((d: { id: string }) => d.id === drawingId),
    ).toBe(false);

    const archivedList = await request(app).get(
      "/drawings?ownerId=user-alice&includeArchived=true",
    );
    expect(
      archivedList.body.drawings.some(
        (d: { id: string }) => d.id === drawingId,
      ),
    ).toBe(true);

    const getArchived = await request(app).get(`/drawings/${drawingId}`);
    expect(getArchived.status).toBe(200);
    expect(getArchived.body.drawing.scene).toEqual(scene);
    expect(getArchived.body.drawing.archivedAt).toEqual(expect.any(String));

    const restoreResponse = await request(app).post(
      `/drawings/${drawingId}/restore`,
    );
    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.drawing.archivedAt).toBeNull();
    expect(restoreResponse.body.drawing.scene).toEqual(scene);

    const restoredList = await request(app).get("/drawings?ownerId=user-alice");
    expect(
      restoredList.body.drawings.some(
        (d: { id: string }) => d.id === drawingId,
      ),
    ).toBe(true);
  });

  it("preserves scene JSON across archive, restart, and restore", async () => {
    const dbPath = createTestDbPath();
    const scene = {
      type: "excalidraw",
      version: 2,
      elements: [{ id: "line-1", type: "line", x: 10, y: 20 }],
      appState: { zenModeEnabled: true },
    };

    const firstDb = createDb(dbPath);
    const firstApp = createApp(firstDb);

    const createResponse = await request(firstApp)
      .post("/drawings")
      .send({ ownerId: "user-bob", title: "Persist me", scene });
    expect(createResponse.status).toBe(201);
    const drawingId = createResponse.body.drawing.id;

    const archiveResponse = await request(firstApp).post(
      `/drawings/${drawingId}/archive`,
    );
    expect(archiveResponse.status).toBe(200);

    closeDb(firstDb);

    const secondDb = createDb(dbPath);
    const secondApp = createApp(secondDb);

    const getAfterRestart = await request(secondApp).get(
      `/drawings/${drawingId}`,
    );
    expect(getAfterRestart.status).toBe(200);
    expect(getAfterRestart.body.drawing.scene).toEqual(scene);
    expect(getAfterRestart.body.drawing.archivedAt).toEqual(expect.any(String));

    const restoreResponse = await request(secondApp).post(
      `/drawings/${drawingId}/restore`,
    );
    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.drawing.archivedAt).toBeNull();
    expect(restoreResponse.body.drawing.scene).toEqual(scene);

    closeDb(secondDb);
  });
});
