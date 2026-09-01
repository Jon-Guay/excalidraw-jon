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

  const distinctiveScene = {
    type: "excalidraw",
    version: 2,
    elements: [{ id: "el-dup-marker", type: "rectangle" }],
    appState: { viewBackgroundColor: "#abcdef" },
  };

  it("duplicates a drawing with the same scene JSON", async () => {
    const app = createTestApp();

    const createResponse = await request(app).post("/drawings").send({
      ownerId: "user-alice",
      title: "Original",
      scene: distinctiveScene,
    });

    expect(createResponse.status).toBe(201);
    const original = createResponse.body.drawing;

    const duplicateResponse = await request(app).post(
      `/drawings/${original.id}/duplicate`,
    );

    expect(duplicateResponse.status).toBe(201);
    const copy = duplicateResponse.body.drawing;
    expect(copy.id).not.toBe(original.id);
    expect(copy.title).toBe("Original (copy)");
    expect(copy.ownerId).toBe("user-alice");
    expect(copy.scene).toEqual(distinctiveScene);
  });

  it("leaves the original drawing unchanged after duplicate", async () => {
    const app = createTestApp();

    const createResponse = await request(app).post("/drawings").send({
      ownerId: "user-alice",
      title: "Original",
      scene: distinctiveScene,
    });

    expect(createResponse.status).toBe(201);
    const original = createResponse.body.drawing;

    const duplicateResponse = await request(app).post(
      `/drawings/${original.id}/duplicate`,
    );
    expect(duplicateResponse.status).toBe(201);

    const getResponse = await request(app).get(`/drawings/${original.id}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.drawing.title).toBe(original.title);
    expect(getResponse.body.drawing.scene).toEqual(original.scene);
    expect(getResponse.body.drawing.createdAt).toBe(original.createdAt);
    expect(getResponse.body.drawing.updatedAt).toBe(original.updatedAt);
  });

  it("returns 404 when duplicating an unknown drawing id", async () => {
    const app = createTestApp();

    const response = await request(app).post(
      "/drawings/does-not-exist/duplicate",
    );

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Drawing not found");
  });
});
