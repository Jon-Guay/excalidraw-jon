# AGENTS.md

## Cursor Cloud specific instructions

This is the Excalidraw monorepo (Yarn 1 workspaces) plus a custom backend API tier
(`server/`) that the `feat/server-tier-demo` branch adds. Standard commands live in
`CLAUDE.md`, root `package.json` scripts, and `scripts/verify.sh`; the notes below only
cover non-obvious setup/run caveats.

### Runnable services

| Service | Dir | Dev command | Port | Notes |
| --- | --- | --- | --- | --- |
| Web app (Vite) | `excalidraw-app/` | `yarn start` (root) | 3001 | Port comes from root `.env.development` (`VITE_APP_PORT=3001`), not 3000. Packages are consumed via Vite path aliases, so no `yarn build:packages` is needed for app dev. |
| Backend API | `server/` | `yarn start:server` (root) | 3003 | Express + SQLite (`drizzle-orm`). Auto-runs migrate + seed on boot; DB file at `server/data/excalidraw.db`. Seeds users Alice/Bob/Carol. |

### Verification gate

`./scripts/verify.sh` runs every gate (deps, typecheck, lint, format, test, boot, migrate,
api). Run a subset by naming gates, e.g. `./scripts/verify.sh typecheck lint test`.

- Known false negative in this environment: the `api` gate's health check passes but it
  reports `health check passed but leaked a server on :3503`. Its port-reclaim matcher
  (`*tsx*server*` / `*server/src/index.ts*`) does not match the tsx argv here
  (`node --import .../tsx/dist/loader.mjs src/index.ts`), so it refuses to kill the test
  server. The API itself is healthy. If `:3503` (or `:3003`) is left occupied, free it by
  the specific PID: `lsof -tiTCP:3503 -sTCP:LISTEN | xargs -r kill`.

### Backend caveats

- SQLite driver: uses `better-sqlite3` when it loads, otherwise falls back to Node's
  built-in `node:sqlite`. On Node 22 the fallback prints
  `ExperimentalWarning: SQLite is an experimental feature` — harmless.
- Server route tests require a per-file `// @vitest-environment node` docblock (see
  `.cursor/skills/server-conventions/SKILL.md`). Route handlers wrap work in `withApiSpan`
  (`.cursor/skills/server-telemetry/SKILL.md`).

### Browser <-> server integration caveat (important)

The web app is wired to the API via `VITE_APP_SERVER_URL=http://localhost:3003` (already in
`.env.development`), which surfaces the user switcher (main menu) and the "Drawings" sidebar
tab. However, the app (`:3001`) and API (`:3003`) are different origins and the server sends
no CORS headers (and there is no Vite dev proxy), so the browser blocks those cross-origin
calls — the server-backed UI loads empty in a plain browser session. Exercise / verify the
server tier via its HTTP API directly (curl) or the vitest route tests, not through the
browser UI, unless CORS or a same-origin proxy is added.

### Node

`.nvmrc` pins Node 20; Node 22 also works.
