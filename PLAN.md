# Adding a server tier

## Why

The repository today is a client that assumes servers exist elsewhere. `.env.development` points at five external services and none of them are in the tree:

| Concern | Env var | Runs at |
| --- | --- | --- |
| Shareable-link JSON store | `VITE_APP_BACKEND_V2_GET_URL` / `_POST_URL` | `json-dev.excalidraw.com` |
| Shape library registry | `VITE_APP_LIBRARY_URL` / `_BACKEND` | `libraries.excalidraw.com` |
| Collaboration socket relay | `VITE_APP_WS_SERVER_URL` | separate `excalidraw-room` repo |
| Text-to-diagram | `VITE_APP_AI_BACKEND` | not public |
| Scene and file persistence | `VITE_APP_FIREBASE_CONFIG` | Firebase Firestore and Storage |

There is no HTTP server, no database, no schema, no migration, and no server-side test anywhere in the tree. A change that would exercise a normal product stack has nowhere to land below the browser.

The goal is a server tier that owns a real domain, so that work touching a migration, a schema, a route, a shared type, a client call, and a test is possible in this repository.

The server tier is a foundation, not a finished product. Phases 0 through 3 build a working backend with routes, migrations, shared types, tests, and committed Cursor rules and skills, so that later feature work — including work an agent picks up from a ticket — lands against an already-green tree.

## Non-goals

These are deliberately excluded. Each was considered and cut.

- **End-to-end encryption changes.** Scenes are encrypted client-side today. Leave that path alone. A server that cannot read scene contents is fine for our purposes.
- **An authentication system.** No password hashing, no sessions, no OAuth, no JWT. A seeded user with a switcher gives us identity without the machinery.
- **Replacing Firebase.** Migration work with no new capability at the end of it.
- **Replacing the collaboration socket server.** Live collaboration already works against the external room server. Owning it changes nothing above it.
- **Microservices, queues, caching, and rate limiting.** Nothing speculative. Add these when a specific change needs them.
- **Full observability infrastructure.** Collectors, span exporters, Jaeger, in-memory recorders, and span-assertion test harnesses are out of scope. What stays in is narrow: a tracer initialised once, one shared span helper, and instrumentation on existing routes so the telemetry rule and skill describe a convention that already exists in the code.
- **Modelling Excalidraw elements in the database.** See "Elements stay opaque" below.
- **Automation infrastructure beyond `verify.yml`.** Webhooks, scheduled jobs, and deployment pipelines are configured outside this repository.
- **Auto-merge, production deploy, or release from automation.** Every change, including agent-driven ones, terminates at an open PR.

## Constraints discovered in the codebase

**Elements stay opaque.** There is no machine-readable schema to derive from. No zod, ajv, io-ts, valibot, yup, OpenAPI, GraphQL, or protobuf appears anywhere. TypeScript types are the source of truth and `packages/excalidraw/data/restore.ts` performs imperative normalization on load. The server therefore stores the scene as opaque JSON and the client runs `restoreElements` after fetching, exactly as it already does for Firebase. Re-modelling elements server-side would duplicate `restore.ts` and drift from it.

**App state is nearly all client-only.** `APP_STATE_STORAGE_CONF` in `packages/excalidraw/appState.ts` marks only five keys as server-persistable: `gridSize`, `gridStep`, `gridModeEnabled`, `viewBackgroundColor`, and `lockedMultiSelections`.

**Element mutation invariants.** Any code that writes elements must bump `version`, assign a fresh `versionNonce`, and set `updated`. Reconciliation in `packages/excalidraw/data/reconcile.ts` resolves conflicts on `version` then `versionNonce`, with the lower nonce winning ties. The server must not author element changes, only store and return them, or it becomes a second writer against an algorithm that assumes it is not.

**Apps live at the top level, libraries live in `packages/`.** `excalidraw-app/` sets the precedent. The service follows it.

**Root `tsconfig.json` only includes `["packages", "excalidraw-app"]`.** A directory outside those two is invisible to `yarn test:typecheck`. This is the most likely way for new code to silently escape the type gate.

**Vitest runs everything in jsdom.** `vitest.config.mts` sets `environment: "jsdom"` globally. Server tests use a per-file `// @vitest-environment node` docblock. This is the chosen strategy; do not leave a projects split as an open alternative. The server-conventions skill states the requirement explicitly so an autonomous agent does not pick wrong.

**`scripts/release.js` publishes an explicit allowlist**, not a glob over `packages/*`. New packages are not published unless added to `PACKAGES`. Mark them `"private": true` anyway.

**No `.cursor/` layer exists yet.** There are no rules, skills, or agents in this repository, and no in-repo pattern to mirror. Rules and skills must be authored from scratch and committed before any cloud agent can see them.

**Cloud agents check out a remote ref.** Uncommitted rules and skills are invisible to automation. Substrate work lands on a named branch, is pushed to `origin`, and is what an automation targets.

**CI on this fork does not mirror local verification.** `test.yml` runs on push to `master` only. Pull requests trigger `lint.yml`, `semantic-pr-title.yml`, `size-limit.yml`, and `test-coverage-pr.yml` inherited from upstream Excalidraw. None of them run `./scripts/verify.sh`. A PR whose title is not a conventional commit fails `semantic-pr-title` even when the code is fine.

**Native SQLite drivers and Node version spread.** `better-sqlite3` compiles via node-gyp on every fresh VM. There is no `.nvmrc`; `engines` says `>=18`, CI uses Node 20, the Dockerfile uses Node 24, and local development may run newer. Node 26 ships a built-in `node:sqlite` module that avoids the compile step. Pick one driver and pin one Node version before Phase 0 closes.

## Shape

Two new workspace members, one fixed server layout, and a `.cursor/` tree. Paths are stable so rule globs can be written once and stay correct.

```
server/
  src/
    index.ts                 listen and shutdown
    app.ts                   create Express app
    routes/
      index.ts               registerRoutes(app) — every route registers here
      health.route.ts
      drawings.route.ts      Phase 2
      users.route.ts         Phase 2
    db/
      schema.ts              Drizzle schema
      client.ts              connection factory
      migrate.ts             idempotent migration runner
      seed.ts                idempotent seed
    telemetry/
      tracer.ts                one-time tracer init
      withApiSpan.ts           shared span helper used by every handler
    middleware/
      errorHandler.ts
packages/api-types/
  src/
    index.ts
    health.ts
    drawings.ts              Phase 1–2
    users.ts                 Phase 1–2
.cursor/
  rules/
    server-telemetry.mdc     globs: server/src/**/*.ts
    server-conventions.mdc   globs: server/src/routes/**, server/src/db/**
  skills/
    server-telemetry/SKILL.md
    server-conventions/SKILL.md
  agents/
    plan-subagent.md
    critique-plan-subagent.md
```

`packages/api-types` covers the new domain only. Drawings, users, and whatever later work introduces. It does not describe elements. A scene crosses the wire as opaque JSON.

**Route registration is the single wiring path.** Handlers live in `server/src/routes/*.route.ts`. Every new endpoint is wired through `registerRoutes` in `server/src/routes/index.ts`, so a feature diff shows both the handler file and a line added to that registry. Bare `app.get(...)` calls elsewhere are out of convention.

**Telemetry convention.** All route handlers wrap work in `withApiSpan(name, attrs, fn)` from `server/src/telemetry/withApiSpan.ts`. The skill prescribes the helper name, attribute keys, and call shape so handlers stay consistent with one another.

## Phase 0. Scaffold

Everything later depends on this, so it lands first and lands green.

### Deliverables

1. `server/` workspace member with `"private": true`.
   - HTTP layer: Express. Chosen for recognizability over novelty. Swapping it later is a contained change, so this is not treated as a one-way door.
   - Database: SQLite through Drizzle. Default driver: `node:sqlite` (built-in, no node-gyp). `better-sqlite3` remains an open decision if `node:sqlite` blocks Drizzle integration. SQLite so `yarn start` works with nothing else running. Drizzle so the schema file generates both the migrations and the query types. The connection string is the only thing that changes to move to Postgres.
   - Layout per Shape above, including `routes/index.ts` with `registerRoutes` and a stub `health.route.ts`.
   - One route, `GET /health`, registered through `registerRoutes`, returning service status and the applied migration version.
   - One migration and one seed script, both runnable and both idempotent.
2. `packages/api-types` workspace member with `"private": true`, initially exporting only the health response type. It exists in Phase 0 so the wiring is proven before Phase 1 has to rely on it.
3. Registration, which is the step most likely to be done incompletely:
   - `package.json` `workspaces` gains `"server"`.
   - Root `tsconfig.json` `include` gains `"server"`.
   - `@excalidraw/api-types` path alias added in all three places that carry aliases: `vitest.config.mts`, root `tsconfig.json`, and `packages/tsconfig.base.json`.
   - Root scripts gain `start:server` and `build:api-types`, with `build:api-types` appended to `build:packages` ahead of any consumer.
   - `packages/utils` is currently published but missing from `build:packages`. Do not copy that pattern.
4. Two new gates in `scripts/verify.sh`:
   - `migrate`, applying migrations to a throwaway database file and asserting a second run is a no-op.
   - `api`, booting the service and asserting `GET /health` returns 200 with the expected body, torn down the same way the `boot` gate tears down vite. Confirm `lsof` is available in CI or provide a port-reclaim fallback; the gate must fail loudly, not pass by probing a leaked process.
5. Cloud runnability and CI:
   - `.nvmrc` pinned to `20` to match `.github/workflows/test.yml`. Treat this as a cloud-runnability requirement, not hygiene alone.
   - `.github/workflows/verify.yml` on `pull_request`, running `./scripts/verify.sh`. Rules and skills guide; this is the deterministic backstop that enforces.
   - Inherited upstream PR workflows: keep `lint.yml`. Remove or disable `semantic-pr-title.yml`, `size-limit.yml`, and `test-coverage-pr.yml` on this fork — they encode upstream Excalidraw release policy, not substrate correctness. Document the constraint separately: future PRs should still use conventional commit titles as a courtesy even without the gate.
6. Branch discipline: substrate work commits to a named branch (for example `substrate/server-tier`), pushes to `origin`, and does not rely on uncommitted local state.

### Done when

Each of these is checkable, and the phase is not done until all of them hold.

1. `./scripts/verify.sh` passes all eight gates from a clean checkout on Node 20.
2. A deliberate type error inside `server/` fails `yarn test:typecheck`. This proves the new directory is actually covered rather than merely present.
3. A server test file with `// @vitest-environment node` runs and can open a database handle, which a jsdom environment would not permit.
4. Deleting the database file and running the migration and seed scripts twice in a row produces the same final state both times.
5. `yarn start` still serves the app with the service not running. The client must degrade, not break, because Phase 0 changes no client behavior.
6. Opening a PR against the substrate branch runs `verify.yml` green.
7. Adding a route without a line in `registerRoutes` is caught by review or test — the registry is the only wiring path.

## Phase 1. Shared domain types

`packages/api-types` becomes the single definition of every request and response the new service exposes. The app imports from it rather than restating shapes.

Done when renaming a field in `packages/api-types` breaks `yarn test:typecheck` at the client call site. A contract that can drift without failing the build is decoration.

## Phase 2. Drawings and users

Two tables. `users`, seeded, no authentication, selected through a switcher in the UI. `drawings`, with an owner, a title, timestamps, and the scene as opaque JSON.

CRUD routes in `server/src/routes/drawings.route.ts` and `server/src/routes/users.route.ts`, each registered in `registerRoutes`, each handler wrapped in `withApiSpan`. Server tests carry the node environment docblock. The app reads and writes through the service. A list view so there is a surface in the client for later work to attach to.

Done when a drawing saved by one user survives a full service restart and a cleared browser storage, and returns elements that `restoreElements` accepts unchanged.

Then stop. The backlog below lists what comes next. Nothing else ships in Phase 2.

## Phase 3. Cursor primitives and telemetry substrate

There is nothing to mirror in this repository. Author the minimum set the conventions above require, commit it, and push.

### Deliverables

1. **`.cursor/rules/server-telemetry.mdc`**

   - `globs`: `server/src/**/*.ts`
   - Short invariants: every route handler uses `withApiSpan`; attribute keys from the skill; no PII or high-cardinality attrs.
   - One line pointing at `.cursor/skills/server-telemetry/SKILL.md`.

2. **`.cursor/skills/server-telemetry/SKILL.md`**

   - How to initialise the tracer (read `server/src/telemetry/tracer.ts`, do not duplicate).
   - Prescribes `withApiSpan(operationName, { "excalidraw.api.route": ..., "excalidraw.api.method": ... }, fn)` as the required call shape.
   - Examples for a GET and a POST handler.

3. **`.cursor/rules/server-conventions.mdc`**

   - `globs`: `server/src/routes/**`, `server/src/db/**`
   - Short invariants: new handlers live in `*.route.ts`; register in `registerRoutes`; server tests use `// @vitest-environment node`; shared types live in `@excalidraw/api-types`.
   - Points at `.cursor/skills/server-conventions/SKILL.md`.

4. **`.cursor/skills/server-conventions/SKILL.md`**

   - Step-by-step for adding an endpoint: create `foo.route.ts`, export handler factory, add one line to `registerRoutes`, add types to `packages/api-types`, add test with node docblock.
   - Registration call site example copied from the real `routes/index.ts`.

5. **`.cursor/agents/plan-subagent.md` and `.cursor/agents/critique-plan-subagent.md`**

   - Thin wrappers. Each `Read`s the relevant skills rather than inlining their contents.
   - Critique subagent checks that planned file paths fall inside telemetry rule globs.

6. **Telemetry substrate in code** (if not already complete from Phase 2):
   - `server/src/telemetry/tracer.ts` — init once, export tracer.
   - `server/src/telemetry/withApiSpan.ts` — the named helper the skill references.
   - Phase 0 `health` and Phase 2 CRUD routes already instrumented.

### Done when

1. Every file under `server/src/routes/` and `server/src/telemetry/` is matched by at least one rule glob.
2. A planning pass against this branch produces a plan that names `registerRoutes` and `withApiSpan` without being given those names, which is how we know the skills are self-sufficient.
3. The critique subagent rejects a plan that adds a route outside `server/src/routes/` or skips registration.
4. All primitives are committed and pushed; `git status` is clean on the substrate branch.

## Backlog

Near-term tickets. Each stays small, edits files already covered by the rule globs, and names the files it touches so ticket writing is transcription.

| Ticket | Scope | Files touched |
| --- | --- | --- |
| **Duplicate drawing** | `POST /drawings/:id/duplicate` copies scene JSON | `drawings.route.ts`, `routes/index.ts`, `packages/api-types/src/drawings.ts`, `schema.ts` (no new table), test file |
| **Archive drawing** | `POST /drawings/:id/archive` soft-delete flag | `drawings.route.ts`, `routes/index.ts`, `schema.ts`, migration, `packages/api-types`, test file |
| **Drawing metadata** | `tags` text column, returned on GET | `schema.ts`, migration, `drawings.route.ts`, `packages/api-types`, test file |

Deliberately excluded from the backlog: folders, comments, sharing, permissions, search, templates, and full duplication flows that span the React app — those either grow past a reviewable diff or edit paths outside `server/src/**`.

## Readiness for agent-driven work

Before handing a backlog ticket to an automation-launched cloud agent, confirm:

| Precondition | Check |
| --- | --- |
| Substrate branch pushed | Remote has latest `.cursor/` and `server/` |
| `./scripts/verify.sh` green locally and on PR | `verify.yml` passes |
| Rule globs × edited paths | Pick a backlog ticket; list its files; each matches `server-telemetry.mdc` globs |
| Registration path exercised | `routes/index.ts` has one line per route |
| Telemetry convention applied | Handlers call `withApiSpan` with the prescribed attribute keys |
| Node pin | `.nvmrc` is 20; cloud image uses same major |
| Automation prompt encodes | explore → plan → critique → implement → instrument per rules → open PR → stop; PR title conventional commit |
| Inherited red checks | Upstream-only PR workflows disabled on this fork |

Dry-run gate: on the substrate branch, run explore → plan → critique against the first backlog ticket without implementing. The plan must cite `registerRoutes`, `@excalidraw/api-types`, and `withApiSpan`. If it does not, fix the skills before handing real work to an agent.

## Verification

`scripts/verify.sh` is the single entry point. It currently runs six gates in about 45 seconds and grows to eight in Phase 0.

| Gate | Checks |
| --- | --- |
| `deps` | `node_modules` matches the lockfile, via `--frozen-lockfile --check-files` |
| `typecheck` | `tsc` across every included directory |
| `lint` | `eslint --max-warnings=0` |
| `format` | prettier reports no differences |
| `test` | the full vitest suite |
| `boot` | the app serves HTML, mounts `#root`, and compiles its entry module |
| `migrate` | migrations apply to a clean database and re-running is a no-op |
| `api` | the service boots and `GET /health` answers |

Every gate must be observed failing before it is trusted. A gate nobody has seen go red is not evidence.

## Open decisions

| Decision | Default if unanswered |
| --- | --- |
| SQLite driver: `node:sqlite` or `better-sqlite3` | `node:sqlite`, to avoid node-gyp in cloud VMs |
| SQLite or Postgres | SQLite, so nothing external is required to run |
| Seeded user or no identity at all | Seeded user, since ownership and authorship depend on it |
| Express or a smaller framework | Express |
| Server test environment | Per-file `// @vitest-environment node` docblock (decided) |
| First ticket after Phase 3 | Rename drawing (smallest diff in backlog) |

## Notes

The repository has no upstream remote configured. `origin` points at the fork. Adding an upstream remote is worthwhile if pulling later fixes matters, and keeping changes additive where practical keeps that option open.

Automation triggers and cloud agent configuration live outside this repository. This plan ends when the substrate branch is green, pushed, and passes the readiness dry-run above.
