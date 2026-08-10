import { Router } from "express";

import type { HealthResponse, LiveResponse } from "@excalidraw/api-types";

import { getAppliedMigrationVersion } from "../db/client.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { withApiSpan } from "../telemetry/withApiSpan.js";

import type { DbClient } from "../db/client.js";

export const createHealthRouter = (db: DbClient): Router => {
  const router = Router();

  router.get(
    "/health",
    asyncHandler(async (_req, res) => {
      const body = await withApiSpan(
        "health.check",
        { "excalidraw.api.route": "/health", "excalidraw.api.method": "GET" },
        (): HealthResponse => ({
          status: "ok",
          migrationVersion: getAppliedMigrationVersion(db),
        }),
      );
      res.json(body);
    }),
  );

  router.get(
    "/live",
    asyncHandler(async (_req, res) => {
      const body = await withApiSpan(
        "live.check",
        { "excalidraw.api.route": "/live", "excalidraw.api.method": "GET" },
        (): LiveResponse => ({
          status: "ok",
        }),
      );
      res.json(body);
    }),
  );

  return router;
};
