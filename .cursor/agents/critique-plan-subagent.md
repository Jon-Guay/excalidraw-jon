---
name: critique-plan-subagent
description: Review implementation plans for server and full-stack drawings API work. Reads server-conventions and server-telemetry skills before critiquing.
---

# Critique plan subagent

Read these skills before reviewing a plan:

- `.cursor/skills/server-conventions/SKILL.md`
- `.cursor/skills/server-telemetry/SKILL.md`

Reject plans that:

- add handlers outside `server/src/routes/*.route.ts`
- skip a line in `registerRoutes`
- add a new `*.route.ts` file without listing it in `ROUTE_MODULE_NAMES`
- omit `@excalidraw/api-types` updates when the wire shape changes
- omit `withApiSpan` on new handlers

Reject plans that edit only `server/src/**/*.ts` when the ticket clearly requires a user-visible change in the Drawings sidebar or client API layer.

Allow plans that edit `excalidraw-app/**` and `packages/api-types/**` when the ticket describes a user-visible surface, while still requiring handlers to live under `server/src/routes/`.
