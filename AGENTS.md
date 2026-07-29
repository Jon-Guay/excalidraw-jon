# AGENTS.md

## Project Structure

Excalidraw is a **monorepo** with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`
- **`examples/`** - Integration examples (NextJS, browser script)

## Development Workflow

1. **Package Development**: Work in `packages/*` for editor features
2. **App Development**: Work in `excalidraw-app/` for app-specific features
3. **Testing**: Always run `yarn test:update` before committing
4. **Type Safety**: Use `yarn test:typecheck` to verify TypeScript

## Development Commands

```bash
yarn test:typecheck  # TypeScript type checking
yarn test:update     # Run all tests (with snapshot updates)
yarn fix             # Auto-fix formatting and linting issues
```

## Architecture Notes

### Package System

- Uses Yarn workspaces for monorepo management
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration

## Cursor Cloud specific instructions

This fork adds a local Express/SQLite **drawings API** (`server/`) on top of stock Excalidraw. Full end-to-end dev requires two long-running services. Follow `.cursor/skills/local-stack/SKILL.md` for details.

- **Start order matters**: run `yarn start:server` (API, `:3003`) before/alongside `yarn start` (Vite app, `:3001`). Without the API, the UI looks like stock Excalidraw with no persona switcher and no drawings. If the app was opened before the API came up, hard-refresh.
- **Seeding is automatic**: the API migrates and seeds users Alice/Bob/Carol into `server/data/excalidraw.db` on boot — no separate seed step. That DB and `server/data/` are gitignored; never commit them. Reset clean state by stopping the API and `rm -f server/data/excalidraw.db*`, then restarting.
- **App→API wiring**: `VITE_APP_SERVER_URL=http://localhost:3003` is already set in `.env.development`. Vite reads it at startup, so restart `yarn start` if you change it.
- **Personas / Drawings UI**: persona switcher + Drawings list live in the right sidebar **Drawings** tab (also in the hamburger menu). Creating a drawing and drawing shapes persists the scene to the API and survives a page reload.
- **Node**: `.nvmrc` pins Node 20 for CI parity, but local dev works on the VM's Node 22 (`better-sqlite3` compiles fine; it falls back to `node:sqlite` if native build fails).
- **Server tests only**: `yarn test:app --watch=false server/` (fast). Other standard commands (`yarn test:typecheck`, `yarn test:update`, `yarn fix`) are covered above under Development Commands.
