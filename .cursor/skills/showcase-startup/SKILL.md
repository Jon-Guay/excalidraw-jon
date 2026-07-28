---
name: showcase-startup
description: Bring this Excalidraw fork to a ready-to-showcase state by installing deps, starting the API and Vite app, seeding users, and verifying the drawings UI. Use when the user asks to start the demo, prepare a showcase, get the repo running, boot Alice/Bob/Carol, or fix a missing user switcher.
---

# Showcase startup

Put the local stack in a state you can demo: Excalidraw UI + drawings API + seeded users.

## Target state

| Service | Command | URL |
| --- | --- | --- |
| API | `yarn start:server` | `http://localhost:3003` |
| App | `yarn start` | `http://localhost:3001` |

- `VITE_APP_SERVER_URL` must be `http://localhost:3003` (set in `.env.development`).
- Seeded users: Alice, Bob, Carol (`user-alice`, `user-bob`, `user-carol`).
- Server migrates and seeds on boot; no separate seed step required for a normal start.

## Yarn invocation

Prefer `yarn` when it is on `PATH`. If `yarn` is missing:

```bash
npx --yes yarn@1.22.22 <script>
# examples:
npx --yes yarn@1.22.22 start:server
npx --yes yarn@1.22.22 start
```

Below, `yarn …` means whichever invocation works in the current shell.

## Steps

Copy and track:

```
Showcase startup:
- [ ] Node ready (see Node section)
- [ ] Dependencies installed
- [ ] API healthy on :3003
- [ ] App serving on :3001
- [ ] Users list returns Alice/Bob/Carol
- [ ] UI smoke: hamburger user switcher + Drawings sidebar tab
```

### 1. Node and install

```bash
node -v
yarn install
```

**Node versions (verified):**

- Local showcase startup works on **Node 26** (API boot + `/health` + `/users`).
- Repo CI pin remains **Node 20** via `.nvmrc`. Prefer 20 when matching CI; Node 26 is fine for local demos.
- If `better-sqlite3` fails to compile, the server falls back to `node:sqlite` on newer Node. Stay on 20 only when you need native-module / CI parity.

### 2. Start API (required first)

```bash
yarn start:server
```

Expect: `server listening on http://localhost:3003`.

Verify:

```bash
curl -s http://localhost:3003/health
curl -s http://localhost:3003/users
```

`/users` must include Alice, Bob, and Carol. If the port is busy, free it or set `PORT`.

### 3. Start app

In a second terminal:

```bash
yarn start
```

Open `http://localhost:3001` and hard-refresh if the app was already open before the API started.

### 4. UI smoke (do not skip)

Personas live in the **Drawings** sidebar (also still in the hamburger menu).

1. Open the right sidebar → **Drawings** tab (library-style icon among sidebar tabs).
2. Use the **Persona** dropdown (Alice / Bob / Carol).
3. Click **New**, draw something, refresh, reopen the drawing.

If the dropdown says users are unavailable, the API is down — start `:3003` and refresh. Vite must have been started after `VITE_APP_SERVER_URL` was added to `.env.development` (restart `yarn start` if unsure).

## Reset to clean seed data

```bash
# stop yarn start:server first
rm -f server/data/excalidraw.db
yarn start:server   # migrates + reseeds Alice/Bob/Carol
```

Optional full verify (slow): `./scripts/verify.sh`.

## Demo talk track (one sentence)

This fork adds a local Express/SQLite drawings API to Excalidraw so Cursor can ship full-stack changes (route, shared types, test) against a real product surface.

## Do not

- Demo without `yarn start:server` — UI looks like stock Excalidraw with no users/drawings.
- Expect Firebase/collab room to be in-repo; only the drawings/users tier is local.
- Commit `server/data/excalidraw.db` or customer-specific demo branches onto `master`.
