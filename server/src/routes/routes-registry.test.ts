// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ROUTE_MODULE_NAMES } from "./index.js";

const routesDir = path.dirname(fileURLToPath(import.meta.url));

describe("registerRoutes registry", () => {
  it("imports every *.route.ts module", () => {
    const routeFiles = fs
      .readdirSync(routesDir)
      .filter((name) => name.endsWith(".route.ts"))
      .sort();

    expect(routeFiles).toEqual([...ROUTE_MODULE_NAMES].sort());
  });

  it("lists each route module in routes/index.ts", () => {
    const indexSource = fs.readFileSync(
      path.join(routesDir, "index.ts"),
      "utf8",
    );

    for (const moduleName of ROUTE_MODULE_NAMES) {
      expect(indexSource).toContain(
        moduleName.replace(".route.ts", ".route.js"),
      );
    }
  });
});
