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

const SCENE = {
  type: "excalidraw",
  version: 2,
  elements: [{ id: "rect-1", type: "rectangle" }],
  appState: {},
};

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

const createTestApp = (dbPath = createTestDbPath()) => {
  const db = createDb(dbPath);
  return { app: createApp(db), db, dbPath };
};

const closeDb = (db: DbClient) => {
  (getSqlite(db) as { close?: () => void }).close?.();
};

afterEach(() => {
  for (const dbPath of tempDbs.splice(0)) {
    fs.rmSync(dbPath, { force: true });
    fs.rmSync(`${dbPath}-wal`, { force: true });
    fs.rmSync(`${dbPath}-shm`, { force: true });
  }
});

describe("drawings routes", () => {
  it("creates, reads, updates, and deletes a drawing", async () => {
    const { app } = createTestApp();

    const createResponse = await request(app)
      .post("/drawings")
      .send({ ownerId: "user-alice", title: "Test drawing" });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.drawing.archivedAt).toBe(null);
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

  it("archives and restores a drawing without dropping scene data", async () => {
    const { app } = createTestApp();

    const createResponse = await request(app)
      .post("/drawings")
      .send({ ownerId: "user-alice", title: "Keep me", scene: SCENE });
    const drawingId = createResponse.body.drawing.id;

    const archiveResponse = await request(app).post(
      `/drawings/${drawingId}/archive`,
    );
    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body.drawing.archivedAt).toEqual(expect.any(String));
    expect(archiveResponse.body.drawing.scene).toEqual(SCENE);

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

    const getResponse = await request(app).get(`/drawings/${drawingId}`);
    expect(getResponse.body.drawing.scene).toEqual(SCENE);

    const restoreResponse = await request(app).post(
      `/drawings/${drawingId}/restore`,
    );
    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.drawing.archivedAt).toBe(null);
    expect(restoreResponse.body.drawing.scene).toEqual(SCENE);

    const restoredList = await request(app).get("/drawings?ownerId=user-alice");
    expect(
      restoredList.body.drawings.some(
        (d: { id: string }) => d.id === drawingId,
      ),
    ).toBe(true);
  });

  it("keeps scene JSON after archive, process restart, and restore", async () => {
    const dbPath = createTestDbPath();
    const first = createTestApp(dbPath);

    const createResponse = await request(first.app)
      .post("/drawings")
      .send({ ownerId: "user-alice", title: "Persist me", scene: SCENE });
    const drawingId = createResponse.body.drawing.id;

    await request(first.app).post(`/drawings/${drawingId}/archive`);
    closeDb(first.db);

    const second = createTestApp(dbPath);
    const getResponse = await request(second.app).get(`/drawings/${drawingId}`);
    expect(getResponse.body.drawing.scene).toEqual(SCENE);
    expect(getResponse.body.drawing.archivedAt).toEqual(expect.any(String));

    const restoreResponse = await request(second.app).post(
      `/drawings/${drawingId}/restore`,
    );
    expect(restoreResponse.body.drawing.scene).toEqual(SCENE);
    expect(restoreResponse.body.drawing.archivedAt).toBe(null);
    closeDb(second.db);
  });

  it("returns 404 when archiving or restoring a missing drawing", async () => {
    const { app } = createTestApp();
    const missing = "00000000-0000-4000-8000-000000000000";

    const archiveResponse = await request(app).post(
      `/drawings/${missing}/archive`,
    );
    expect(archiveResponse.status).toBe(404);

    const restoreResponse = await request(app).post(
      `/drawings/${missing}/restore`,
    );
    expect(restoreResponse.status).toBe(404);
  });
});
