---
name: server-conventions
description: Add or change a drawings API endpoint — route module shape, router registration, the route module registry, shared request and response types, and server test setup. Use when touching server/src/routes or packages/api-types.
---

# Server conventions

## Adding an endpoint

1. Add or extend types in `packages/api-types/src/`.
2. Create `server/src/routes/foo.route.ts` exporting `createFooRouter(db)`.
3. Register the router in `registerRoutes` inside `server/src/routes/index.ts`.
4. Add the module filename to `ROUTE_MODULE_NAMES` in the same file (`routes-registry.test.ts` enforces this).
5. Wrap every handler with `withApiSpan` per the telemetry skill.
6. Add a test file with `// @vitest-environment node`.

## Registration call site

```ts
export const registerRoutes = (app: Express, db: DbClient): void => {
  app.use(createHealthRouter(db));
  app.use(createUsersRouter(db));
  app.use(createDrawingsRouter(db));
};
```

Add one `app.use(createFooRouter(db))` line per new route module.

## Route module shape

```ts
export const createFooRouter = (db: DbClient): Router => {
  const router = Router();

  router.get(
    "/foo",
    asyncHandler(async (_req, res) => {
      const body = await withApiSpan(
        "foo.list",
        { "excalidraw.api.route": "/foo", "excalidraw.api.method": "GET" },
        () => ({ items: [] }),
      );
      res.json(body);
    }),
  );

  return router;
};
```

## Tests

```ts
// @vitest-environment node
```

Place tests beside the route file as `*.route.test.ts`.

## Shared types

Import response and request types from `@excalidraw/api-types` in both the server and `excalidraw-app/data/serverApi.ts`.
