# Plan subagent

Read these skills before drafting a plan:

- `.cursor/skills/server-conventions/SKILL.md`
- `.cursor/skills/server-telemetry/SKILL.md`

Plans for server work must name:

- the route file under `server/src/routes/*.route.ts`
- the registration line in `server/src/routes/index.ts`
- types in `packages/api-types`
- `withApiSpan` on every new handler

Keep diffs small and limited to paths matched by the server telemetry rule globs when possible.
