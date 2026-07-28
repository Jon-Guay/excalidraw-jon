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

describe("GET /users", () => {
  it("returns the seeded users", async () => {
    const app = createTestApp();
    const response = await request(app).get("/users");

    expect(response.status).toBe(200);
    expect(response.body.users.map((user: { id: string }) => user.id)).toEqual(
      expect.arrayContaining(["user-alice", "user-bob", "user-carol"]),
    );
  });

  it("returns an id, name, and ISO createdAt for each user", async () => {
    const app = createTestApp();
    const response = await request(app).get("/users");

    for (const user of response.body.users) {
      expect(user).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        createdAt: expect.any(String),
      });
      expect(new Date(user.createdAt).toISOString()).toBe(user.createdAt);
    }
  });
});
