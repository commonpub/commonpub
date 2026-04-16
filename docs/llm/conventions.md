# LLM Conventions — CommonPub

Code style, naming, and standing rules. Enforced by CI in some places, by
convention in others — but all are respected by maintainers, so follow them.

## Standing rules (from CLAUDE.md)

1. **The schema is the work** — features start with schema, not UI.
2. **No feature without a flag** in `commonpub.config.ts`.
3. **No hardcoded color or font** in `@commonpub/ui`, `@commonpub/docs`, or the layer — always `var(--*)`.
4. **Docs use BlockTuple[]** format — new pages store content as blocks.
5. **Hubs local-only in v1** unless `federateHubs` flag on.
6. **"Hub" is the umbrella** — three types: community, product, company.
7. **Convex is not self-hostable** — the answer is Postgres.
8. **Better Auth is a library**, not a separate service.
9. **AP actor SSO = Model B** (OAuth2). Shared auth DB = Model C, operator opt-in only.
10. **No federation before two instances exist with real content.**
11. **Test-driven**: tests first, then implementation.
12. **Accessibility-first** — WCAG 2.1 AA minimum.
13. **Session logging** — after each work session, update `docs/sessions/NNN-*.md`.
14. **Research before building** — web research for each major system.
15. **Never add Claude as co-author** in any commit, in any repo.

## File naming

| Kind | Convention |
|---|---|
| Vue components | `PascalCase.vue` |
| TypeScript modules | `camelCase.ts` |
| Schema files | `camelCase.ts` |
| CSS files | `kebab-case.css` |
| Tests | `*.test.ts` |
| ADRs | `NNN-kebab.md` |
| Session logs | `NNN-description.md` |

## Code style

- TypeScript strict mode. **No `any`.** No `as unknown as`.
- Explicit return types on all exported functions.
- Vue 3 Composition API with `<script setup lang="ts">`. **No Options API.**
- Nuxt conventions: auto-imports, file-based routing, Nitro server routes.
- Drizzle query builder. Raw SQL only when necessary (and comment why).
- `var(--*)` only in styles — zero hardcoded colors/fonts.
- Feature flags checked via `@commonpub/config` before enabling any feature.
- CSS class prefix: `cpub-` (CommonPub).

## Git conventions

- Conventional commits: `feat(schema):`, `fix(auth):`, `test(editor):`, `docs(adr):`, `chore(deps):`
- Atomic commits — one logical change per commit.
- PRs with summary + test plan.
- Squash merge to main.
- **No AI attribution** in commit trailers.

## Component standards

- **Headless** — structure + behavior, no visual opinions beyond CSS custom properties.
- Always accept `class` prop for external styling (`$attrs` or explicit).
- Keyboard navigable — every interactive element.
- ARIA labels on every interactive element.
- WCAG 2.1 AA contrast and sizing minimum.

## Design system

Base theme:
- Sharp corners (`--radius: 0px`)
- 2px borders (`--border-width-default: 2px`)
- Offset shadows (no blur)
- JetBrains Mono for UI labels (uppercase, letter-spaced)
- Blue accent (`#5b9cf6`), cool neutral palette
- 16px base font, line-height 1.7
- Fonts: Fraunces (display), Work Sans (body)

Source: `layers/base/theme/base.css`. Don't hardcode these values — use the tokens.

## Server module conventions

Modules under `packages/server/src/<domain>/`:
- First arg is always `db: DB` (Drizzle handle).
- Use transactions for multi-step correctness (voting, RSVP, content publish).
- Emit lifecycle hooks (`emitHook`) for cross-cutting side effects (email, indexing, federation).
- Never reach outside the module for DB tables that aren't part of your domain — call another module's function instead.
- Export a public surface via `<domain>/index.ts`.
- Register in `packages/server/src/index.ts`.

## API route conventions

- File names: `index.<method>.ts` (top-level) or `[param]/<action>.<method>.ts`.
- `defineEventHandler` only.
- Access DB via `useDb()` utility.
- Access session via `event.context.user` (populated by server middleware).
- Access features via `event.context.features.<flag>`.
- Errors via `createError({ statusCode, statusMessage })`.
- Validate input with the Zod validator from `@commonpub/schema`.
- For authed routes, check `event.context.user` — 401 if absent.

## Zod validator conventions

- Live in `packages/schema/src/validators.ts`.
- One `create<Thing>Schema`, one `update<Thing>Schema` per mutable entity.
- Re-use enum schemas (`contestStatusSchema`, `voteDirectionSchema`) rather than inlining `z.enum([...])`.
- For filters: `<thing>FiltersSchema` with pagination (`limit`, `offset`).

## Hook events

Use the bus in `packages/server/src/hooks.ts`:

| Event | Fire after |
|---|---|
| `content:published` | publish commits |
| `content:updated` | update commits |
| `content:deleted` | soft-delete commits |
| `content:liked`, `content:unliked` | like toggle |
| `comment:created` | comment commits |
| `hub:post:created` | post commits |
| `hub:member:joined`, `hub:member:left` | membership change |
| `hub:content:shared` | share commits |
| `user:registered` | Better Auth after-register |
| `federation:content:received` | inbox ingest |
| `federation:hub:post:received` | hub inbox ingest |

Register handlers in layer server plugins (`layers/base/server/plugins/*`).

## Package versioning

- Bump semver minor for additive changes.
- Bump major for any removal or rename.
- Update CHANGELOG in the SAME commit.
- `pnpm publish`, never `npm publish`.
- Run `pnpm publish:check` (build + typecheck + test) before publishing.
- Verify `dist/` contains the expected public API before publishing.

## Feature flag conventions

- Default OFF for anything non-core.
- Default ON only for: content, social, hubs, docs, video, learning, explainers, editorial.
- Gate in all four places: server code, route middleware, component markup, nav items.
- Document the flag in `docs/reference/guides/feature-flags.md` AND in `codebase-analysis/08-feature-flags-inventory.md`.

## Testing conventions

- Unit tests first. Integration + E2E as appropriate.
- Co-locate unit tests: `foo.ts` + `foo.test.ts`.
- Integration tests use PGlite by default; 3 are skipped for PGlite incompatibility.
- Component tests use `@testing-library/vue` + `axe-core` for a11y.
- E2E with Playwright under `apps/reference/e2e/`.

## Documentation conventions

- Every new feature = session log at `docs/sessions/NNN-description.md`.
- Reference doc in `docs/reference/` in the same PR as the feature.
- Breaking changes → CHANGELOG entry.
- Architecture decisions → new ADR at `docs/adr/NNN-description.md` with status + date fields.
