# LLM Context — CommonPub

For Claude Code, Cursor, and other coding agents working on this repo.

## Load order

Start with this file, then load in this order based on the task:

1. [`facts.md`](./facts.md) — Condensed architecture facts. ~Always load this.
2. [`conventions.md`](./conventions.md) — Code style, naming, standing rules.
3. [`gotchas.md`](./gotchas.md) — Non-obvious pitfalls. Load before making changes.
4. [`task-recipes.md`](./task-recipes.md) — Step-by-step flows for common tasks.

For deep reference, point the agent at:

- `codebase-analysis/` (repo root) — full inventory of tables, routes, components.
- `docs/sessions/NNN-*.md` — chronological decision log.
- `docs/adr/` — architecture decisions.

For human-readable background, see [`../guides/`](../guides/).

## Priorities

When in doubt:

1. **The schema is the work.** New features start with the right tables.
2. **No feature without a flag** in `commonpub.config.ts`.
3. **Read session logs** for recent changes — they're newer than reference docs.
4. **Check `codebase-analysis/`** for the current shape of things.
5. **Never add Claude as co-author** in commits.
6. **pnpm, never npm.**

## Cwd awareness

The primary repo is `/Users/obsidian/Projects/ossuary-projects/commonpub/`.
The thin consumer is `/Users/obsidian/Projects/ossuary-projects/deveco-io/`.

Frozen / ignore:
- `/Users/obsidian/Projects/commonpub/`
- `/Users/obsidian/Projects/deveco/deveco-io/`

## Quick nav

| Task | Go to |
|---|---|
| Add a table | `packages/schema/src/` + `validators.ts` |
| Add a server function | `packages/server/src/<domain>/` |
| Add an API route | `layers/base/server/api/` |
| Add a page | `layers/base/pages/` |
| Add a component | `layers/base/components/` |
| Add a feature flag | `packages/config/src/types.ts` + `schema.ts` |
| Add branding | Consumer app `assets/theme.css` |
| Read recent work | `docs/sessions/` (latest is highest NNN) |
