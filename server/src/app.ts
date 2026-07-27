import express from "express";

import { errorHandler } from "./middleware/errorHandler.js";
import { registerRoutes } from "./routes/index.js";

import type { DbClient } from "./db/client.js";

export const createApp = (db: DbClient) => {
  const app = express();
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: "10mb" }));
  registerRoutes(app, db);
  app.use(errorHandler);
  return app;
};
