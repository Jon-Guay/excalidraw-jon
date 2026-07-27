# Critique plan subagent

Read these skills before reviewing a plan:

- `.cursor/skills/server-conventions/SKILL.md`
- `.cursor/skills/server-telemetry/SKILL.md`

Reject plans that:

- add handlers outside `server/src/routes/*.route.ts`
- skip a line in `registerRoutes`
- omit `@excalidraw/api-types` updates when the wire shape changes
- omit `withApiSpan` on new handlers

Reject plans whose edited paths fall outside `server/src/**/*.ts` when the ticket is a server showcase item.
