import { Router } from "express";

import type { HealthResponse, LivenessResponse } from "@excalidraw/api-types";

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
    "/livez",
    asyncHandler(async (_req, res) => {
      const body = await withApiSpan(
        "health.live",
        { "excalidraw.api.route": "/livez", "excalidraw.api.method": "GET" },
        (): LivenessResponse => ({ status: "ok" }),
      );
      res.json(body);
    }),
  );

  return router;
};
