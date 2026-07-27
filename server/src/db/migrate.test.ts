// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getAppliedMigrationVersion } from "./client.js";
import { createDb } from "./client.js";
import { migrate } from "./migrate.js";

describe("migrate", () => {
  it("is idempotent", () => {
    const dbPath = path.join(
      os.tmpdir(),
      `excalidraw-migrate-${Date.now()}.db`,
    );

    const first = migrate(dbPath);
    const second = migrate(dbPath);

    expect(first).toBe("0001_init");
    expect(second).toBe("0001_init");
    expect(getAppliedMigrationVersion(createDb(dbPath))).toBe("0001_init");

    fs.rmSync(dbPath, { force: true });
  });
});
