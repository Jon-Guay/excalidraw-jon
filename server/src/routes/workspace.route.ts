import { count, max } from "drizzle-orm";
import { Router } from "express";

import type { WorkspaceSummaryResponse } from "@excalidraw/api-types";

import { drawings, users } from "../db/schema.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { withApiSpan } from "../telemetry/withApiSpan.js";

import type { DbClient } from "../db/client.js";

const toIsoTimestamp = (
  value: Date | number | null | undefined,
): string | null => {
  if (value == null) {
    return null;
  }
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
};

export const createWorkspaceRouter = (db: DbClient): Router => {
  const router = Router();

  router.get(
    "/workspace/summary",
    asyncHandler(async (_req, res) => {
      const body = await withApiSpan(
        "workspace.summary",
        {
          "excalidraw.api.route": "/workspace/summary",
          "excalidraw.api.method": "GET",
        },
        (): WorkspaceSummaryResponse => {
          const drawingAgg = db
            .select({
              drawingCount: count(),
              latestUpdatedAt: max(drawings.updatedAt),
            })
            .from(drawings)
            .get();
          const userAgg = db.select({ userCount: count() }).from(users).get();

          return {
            drawingCount: drawingAgg?.drawingCount ?? 0,
            userCount: userAgg?.userCount ?? 0,
            latestUpdatedAt: toIsoTimestamp(drawingAgg?.latestUpdatedAt),
          };
        },
      );
      res.json(body);
    }),
  );

  return router;
};
