import { createDb } from "./client.js";
import { migrate } from "./migrate.js";
import { users } from "./schema.js";

const SEEDED_USERS = [
  { id: "user-alice", name: "Alice" },
  { id: "user-bob", name: "Bob" },
  { id: "user-carol", name: "Carol" },
] as const;

export const seed = (dbPath?: string): void => {
  const resolved = dbPath ?? process.env.DB_FILE_NAME ?? "./data/excalidraw.db";
  migrate(resolved);
  const db = createDb(resolved);
  const now = new Date();

  for (const user of SEEDED_USERS) {
    db.insert(users)
      .values({
        id: user.id,
        name: user.name,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { name: user.name },
      })
      .run();
  }
};

export const runSeed = (): void => {
  seed();
};

if (process.argv[1]?.endsWith("seed.ts")) {
  runSeed();
  process.stdout.write("seed complete\n");
}
