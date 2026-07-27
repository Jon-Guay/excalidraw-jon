import { createDb } from "./db/client.js";
import { migrate } from "./db/migrate.js";
import { seed } from "./db/seed.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3003);
const DB_FILE_NAME = process.env.DB_FILE_NAME ?? "./data/excalidraw.db";

const start = () => {
  migrate(DB_FILE_NAME);
  seed(DB_FILE_NAME);
  const db = createDb(DB_FILE_NAME);
  const app = createApp(db);

  const server = app.listen(PORT, () => {
    process.stdout.write(`server listening on http://localhost:${PORT}\n`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

start();
