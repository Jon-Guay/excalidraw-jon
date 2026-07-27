import { Router } from "express";

import type { ListUsersResponse, User } from "@excalidraw/api-types";

import { users } from "../db/schema.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { withApiSpan } from "../telemetry/withApiSpan.js";

import type { DbClient } from "../db/client.js";

const toUser = (row: typeof users.$inferSelect): User => ({
  id: row.id,
  name: row.name,
  createdAt: new Date(row.createdAt).toISOString(),
});

export const createUsersRouter = (db: DbClient): Router => {
  const router = Router();

  router.get(
    "/users",
    asyncHandler(async (_req, res) => {
      const body = await withApiSpan(
        "users.list",
        { "excalidraw.api.route": "/users", "excalidraw.api.method": "GET" },
        (): ListUsersResponse => ({
          users: db.select().from(users).all().map(toUser),
        }),
      );
      res.json(body);
    }),
  );

  return router;
};
