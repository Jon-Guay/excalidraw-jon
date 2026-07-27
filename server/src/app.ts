import express from "express";

import { errorHandler } from "./middleware/errorHandler.js";
import { registerRoutes } from "./routes/index.js";

import type { DbClient } from "./db/client.js";

export const createApp = (db: DbClient) => {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  registerRoutes(app, db);
  app.use(errorHandler);
  return app;
};
