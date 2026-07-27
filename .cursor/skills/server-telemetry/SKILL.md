# Server telemetry

## Tracer

Read `server/src/telemetry/tracer.ts` and call `initTracer()` through `withApiSpan`. Do not duplicate tracer setup elsewhere.

## Span helper

Every route handler wraps work in:

```ts
await withApiSpan(
  "resource.action",
  {
    "excalidraw.api.route": "/path",
    "excalidraw.api.method": "GET",
  },
  async () => {
    // handler body
  },
);
```

## GET example

```ts
router.get(
  "/drawings/:id",
  asyncHandler(async (req, res) => {
    const body = await withApiSpan(
      "drawings.get",
      {
        "excalidraw.api.route": "/drawings/:id",
        "excalidraw.api.method": "GET",
      },
      () => {
        // read from db
        return { drawing };
      },
    );
    res.json(body);
  }),
);
```

## POST example

```ts
router.post(
  "/drawings",
  asyncHandler(async (req, res) => {
    const body = await withApiSpan(
      "drawings.create",
      {
        "excalidraw.api.route": "/drawings",
        "excalidraw.api.method": "POST",
      },
      () => {
        // insert row
        return { drawing };
      },
    );
    res.status(201).json(body);
  }),
);
```

## Attributes

Always set:

- `excalidraw.api.route`
- `excalidraw.api.method`

Never attach user names, emails, drawing titles, or raw scene JSON to spans.
