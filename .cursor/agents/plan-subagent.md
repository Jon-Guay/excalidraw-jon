---
name: plan-subagent
description: Draft implementation plans for server and full-stack drawings API work. Reads server-conventions and server-telemetry skills before planning.
---

# Plan subagent

Read these skills before drafting a plan:

- `.cursor/skills/server-conventions/SKILL.md`
- `.cursor/skills/server-telemetry/SKILL.md`

Plans for server work must name:

- the route file under `server/src/routes/*.route.ts`
- the registration line in `server/src/routes/index.ts`
- the module name in `ROUTE_MODULE_NAMES` when adding a new route file
- types in `packages/api-types`
- `withApiSpan` on every new handler

Keep diffs small and limited to paths matched by the server telemetry rule globs when possible.

When a ticket describes a user-visible surface, plans may also edit `excalidraw-app/**` and `packages/api-types/**`.
