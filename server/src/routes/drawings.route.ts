import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { Router } from "express";

import type {
  CreateDrawingRequest,
  CreateDrawingResponse,
  DeleteDrawingResponse,
  Drawing,
  GetDrawingResponse,
  ListDrawingsResponse,
  UpdateDrawingRequest,
  UpdateDrawingResponse,
} from "@excalidraw/api-types";

import { drawings } from "../db/schema.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { withApiSpan } from "../telemetry/withApiSpan.js";

import type { DbClient } from "../db/client.js";

const parseScene = (value: string): unknown => JSON.parse(value);

const toDrawing = (row: typeof drawings.$inferSelect): Drawing => ({
  id: row.id,
  ownerId: row.ownerId,
  title: row.title,
  scene: parseScene(row.scene),
  createdAt: new Date(row.createdAt).toISOString(),
  updatedAt: new Date(row.updatedAt).toISOString(),
});

export const createDrawingsRouter = (db: DbClient): Router => {
  const router = Router();

  router.get(
    "/drawings",
    asyncHandler(async (req, res) => {
      const ownerId =
        typeof req.query.ownerId === "string" ? req.query.ownerId : undefined;

      const body = await withApiSpan(
        "drawings.list",
        { "excalidraw.api.route": "/drawings", "excalidraw.api.method": "GET" },
        (): ListDrawingsResponse => {
          const rows = ownerId
            ? db
                .select()
                .from(drawings)
                .where(eq(drawings.ownerId, ownerId))
                .all()
            : db.select().from(drawings).all();
          return { drawings: rows.map(toDrawing) };
        },
      );
      res.json(body);
    }),
  );

  router.get(
    "/drawings/:id",
    asyncHandler(async (req, res) => {
      const body = await withApiSpan(
        "drawings.get",
        {
          "excalidraw.api.route": "/drawings/:id",
          "excalidraw.api.method": "GET",
        },
        (): GetDrawingResponse => {
          const row = db
            .select()
            .from(drawings)
            .where(eq(drawings.id, req.params.id))
            .get();
          if (!row) {
            throw new HttpError(404, "Drawing not found");
          }
          return { drawing: toDrawing(row) };
        },
      );
      res.json(body);
    }),
  );

  router.post(
    "/drawings",
    asyncHandler(async (req, res) => {
      const payload = req.body as CreateDrawingRequest;
      if (!payload?.ownerId || !payload?.title) {
        throw new HttpError(400, "ownerId and title are required");
      }

      const body = await withApiSpan(
        "drawings.create",
        {
          "excalidraw.api.route": "/drawings",
          "excalidraw.api.method": "POST",
        },
        (): CreateDrawingResponse => {
          const now = new Date();
          const row = {
            id: randomUUID(),
            ownerId: payload.ownerId,
            title: payload.title,
            scene: JSON.stringify(
              payload.scene ??
                ({
                  type: "excalidraw",
                  version: 2,
                  elements: [],
                  appState: {},
                } as unknown),
            ),
            createdAt: now,
            updatedAt: now,
          };
          db.insert(drawings).values(row).run();
          return { drawing: toDrawing(row) };
        },
      );
      res.status(201).json(body);
    }),
  );

  router.patch(
    "/drawings/:id",
    asyncHandler(async (req, res) => {
      const payload = req.body as UpdateDrawingRequest;

      const body = await withApiSpan(
        "drawings.update",
        {
          "excalidraw.api.route": "/drawings/:id",
          "excalidraw.api.method": "PATCH",
        },
        (): UpdateDrawingResponse => {
          const existing = db
            .select()
            .from(drawings)
            .where(eq(drawings.id, req.params.id))
            .get();
          if (!existing) {
            throw new HttpError(404, "Drawing not found");
          }

          const updatedAt = new Date();
          const next = {
            title: payload.title ?? existing.title,
            scene: JSON.stringify(payload.scene ?? parseScene(existing.scene)),
            updatedAt,
          };

          db.update(drawings)
            .set(next)
            .where(eq(drawings.id, req.params.id))
            .run();

          return {
            drawing: toDrawing({
              ...existing,
              ...next,
            }),
          };
        },
      );
      res.json(body);
    }),
  );

  router.delete(
    "/drawings/:id",
    asyncHandler(async (req, res) => {
      const body = await withApiSpan(
        "drawings.delete",
        {
          "excalidraw.api.route": "/drawings/:id",
          "excalidraw.api.method": "DELETE",
        },
        (): DeleteDrawingResponse => {
          const existing = db
            .select()
            .from(drawings)
            .where(eq(drawings.id, req.params.id))
            .get();
          if (!existing) {
            throw new HttpError(404, "Drawing not found");
          }
          db.delete(drawings).where(eq(drawings.id, req.params.id)).run();
          return { id: req.params.id };
        },
      );
      res.json(body);
    }),
  );

  return router;
};
