import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { Router } from "express";

import type {
  ArchiveDrawingResponse,
  CreateDrawingRequest,
  CreateDrawingResponse,
  DeleteDrawingResponse,
  Drawing,
  GetDrawingResponse,
  ListDrawingsQuery,
  ListDrawingsResponse,
  RestoreDrawingResponse,
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
  archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
});

const parseListQuery = (query: unknown): ListDrawingsQuery => {
  const q = query as Record<string, unknown>;
  return {
    ownerId: typeof q.ownerId === "string" ? q.ownerId : undefined,
    includeArchived: q.includeArchived === "true",
  };
};

const listWhere = (ownerId?: string, includeArchived?: boolean) => {
  const conditions = [];
  if (ownerId) {
    conditions.push(eq(drawings.ownerId, ownerId));
  }
  if (!includeArchived) {
    conditions.push(isNull(drawings.archivedAt));
  }
  if (conditions.length === 0) {
    return undefined;
  }
  if (conditions.length === 1) {
    return conditions[0];
  }
  return and(...conditions);
};

export const createDrawingsRouter = (db: DbClient): Router => {
  const router = Router();

  router.get(
    "/drawings",
    asyncHandler(async (req, res) => {
      const { ownerId, includeArchived } = parseListQuery(req.query);

      const body = await withApiSpan(
        "drawings.list",
        { "excalidraw.api.route": "/drawings", "excalidraw.api.method": "GET" },
        (): ListDrawingsResponse => {
          const where = listWhere(ownerId, includeArchived);
          const rows = where
            ? db.select().from(drawings).where(where).all()
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
            archivedAt: null,
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

  router.post(
    "/drawings/:id/archive",
    asyncHandler(async (req, res) => {
      const body = await withApiSpan(
        "drawings.archive",
        {
          "excalidraw.api.route": "/drawings/:id/archive",
          "excalidraw.api.method": "POST",
        },
        (): ArchiveDrawingResponse => {
          const existing = db
            .select()
            .from(drawings)
            .where(eq(drawings.id, req.params.id))
            .get();
          if (!existing) {
            throw new HttpError(404, "Drawing not found");
          }
          const updatedAt = new Date();
          const archivedAt = new Date();
          db.update(drawings)
            .set({ archivedAt, updatedAt })
            .where(eq(drawings.id, req.params.id))
            .run();
          return {
            drawing: toDrawing({
              ...existing,
              archivedAt,
              updatedAt,
            }),
          };
        },
      );
      res.json(body);
    }),
  );

  router.post(
    "/drawings/:id/restore",
    asyncHandler(async (req, res) => {
      const body = await withApiSpan(
        "drawings.restore",
        {
          "excalidraw.api.route": "/drawings/:id/restore",
          "excalidraw.api.method": "POST",
        },
        (): RestoreDrawingResponse => {
          const existing = db
            .select()
            .from(drawings)
            .where(eq(drawings.id, req.params.id))
            .get();
          if (!existing) {
            throw new HttpError(404, "Drawing not found");
          }
          const updatedAt = new Date();
          db.update(drawings)
            .set({ archivedAt: null, updatedAt })
            .where(eq(drawings.id, req.params.id))
            .run();
          return {
            drawing: toDrawing({
              ...existing,
              archivedAt: null,
              updatedAt,
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
