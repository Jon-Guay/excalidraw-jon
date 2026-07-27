import { createDrawingsRouter } from "./drawings.route.js";
import { createHealthRouter } from "./health.route.js";
import { createUsersRouter } from "./users.route.js";

import type { DbClient } from "../db/client.js";

import type { Express } from "express";

export const registerRoutes = (app: Express, db: DbClient): void => {
  app.use(createHealthRouter(db));
  app.use(createUsersRouter(db));
  app.use(createDrawingsRouter(db));
};

export const ROUTE_MODULE_NAMES = [
  "health.route.ts",
  "users.route.ts",
  "drawings.route.ts",
] as const;
