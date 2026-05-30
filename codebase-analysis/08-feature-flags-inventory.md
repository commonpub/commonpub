# 08 — Feature Flags Inventory

Flags live in `packages/config/src/types.ts` → `FeatureFlags`. Set in
`commonpub.config.ts` at the app level. Gated in: server modules (check at call
site), layer pages (`feature-gate.global.ts` middleware), layer components
(via `useFeatures()` composable), nav items (per-item `requiredFeature`).

17 top-level flags + 5 nested `identity.*` sub-flags.

| Flag | Default | What it gates | Runtime override? |
|---|---|---|---|
| `content` | ON | Content CRUD, `/[type]`, `/u/:user/:type/:slug`, editor pages | admin `/features` |
| `social` | ON | Likes, follows, comments, bookmarks, reports | admin |
| `hubs` | ON | `/hubs/**`, hub API routes, hub nav item | admin |
| `docs` | ON | `/docs/**`, docs editor, search | admin |
| `video` | ON | `/videos/**`, video submit, video API | admin |
| `learning` | ON | `/learn/**`, enrollments, certificates | admin |
| `explainers` | ON | Explainer content type + interactive rendering | admin |
| `editorial` | ON | Staff picks, editorial badges, homepage editorial section, categories admin | admin |
| `admin` | ON (since config 0.13.0 prod default) | `/admin/**`, admin API, admin nav | admin |
| `contentImport` | ON (added config 0.13.0) | `/api/content/import` (URL → content) | admin |
| `contests` | **OFF** | `/contests/**`, contest API, judges, voting | admin |
| `events` | **OFF** | `/events/**`, events API, RSVP | admin |
| `federation` | **OFF default** (live `true` on commonpub.io + deveco.io as of session 137-ish; verify with `curl /api/features` before any "dormant" claim) | AP `.well-known/*`, `/api/federation/**`, inbox, outbox | admin |
| `federateHubs` | **OFF default** (live `true` on commonpub.io + deveco.io) | Hub Group actor + FEP-1b12 hub federation | admin |
| `seamlessFederation` | **OFF default** (live `true` on commonpub.io + deveco.io) | Merge federated content into local browse/search/feed | admin |
| `emailNotifications` | **OFF** | Outbound email for likes/comments/follows/mentions/digest | admin |
| `publicApi` | **OFF** | `/api/public/v1/**` read API (admin-managed bearer tokens, 13 read scopes) | admin |
| `layoutEngine` | **OFF default** (added session 157; shipped in config 0.15.0 + layer 0.23.x — session 158. **Live `true` on commonpub.io via a runtime override** as of session 159 canary — build-config default stays OFF; verify with `curl /api/features`) | Phase 1 layout engine. When ON, `<LayoutSlot>` renders from `layouts`/`layout_rows`/`layout_sections` DB tables (migration 0005) instead of the legacy `homepage.sections` JSON. `/api/layouts/by-route` 404s when off so the legacy `HomepageSectionRenderer` stays in charge. **As of layer 0.23.3: auto-fallback** — when the flag is ON but no layout exists at scope `('route', '/')`, `pages/index.vue` falls through to the legacy renderer instead of rendering blank `<LayoutSlot>` zones (fixes "operator flips flag → blank homepage" trap). To actually use the engine, operator must FIRST `POST /api/admin/layouts/seed-homepage` (admin auth) to populate a default layout, THEN flip the flag. | admin (Phase 4 adoption) |
| `identity.linkRemoteAccounts` | **OFF** (added config 0.12.0) | UI for linking a remote AP account; requires `CPUB_FED_TOKEN_KEY` | admin |
| `identity.signInWithRemote` | **OFF** | Mastodon-login flow; requires `CPUB_FED_TOKEN_KEY` | admin |
| `identity.actingAs` | **OFF** | "Acting as remote identity" banner + UI (no token I/O, no key needed) | admin |
| `identity.remoteInteract` | **OFF** | Delegated likes/follows on the remote; requires `CPUB_FED_TOKEN_KEY` | admin |
| `identity.remotePublish` | **OFF** | Delegated publish to the remote; requires `CPUB_FED_TOKEN_KEY` | admin |

## Where flags are consumed

**Server middleware** (`layers/base/server/middleware/features.ts`):
- Reads runtime config + DB overrides
- Populates `event.context.features`

**Client composable** (`useFeatures()`):
- Hydrated from `/api/features` on initial load
- Reactive; `<div v-if="features.events">` works as expected

**Global route middleware** (`middleware/feature-gate.global.ts`):
- Path mapping: `/learn → learning`, `/docs → docs`, `/videos → video`, `/admin → admin`, `/contests → contests`, `/events → events`, `/explainer → explainers`
- Throws 404 for disabled features
- **Important:** has a `DEFAULT_FLAGS` fallback for SSR — session 124 hit a crash here when `useFeatures()` ran before hydration

**API routes:**
- Most check `event.context.features.<flag>` and `throw createError({ statusCode: 404 })` if off
- Federation endpoints are hard-gated by Nitro route rules + middleware

**Admin runtime overrides** (`/admin/features`):
- Writes to `instanceSettings.features.<flag>` (JSONB)
- Layered over build-time `commonpub.config.ts`
- Only admin-visible flags overridable via UI
- **As of layer 0.23.2**: `PUT /api/admin/features` persists overrides verbatim. Previously a dedup loop compared each override against `config.features` (which was the EFFECTIVE config — already had the existing override applied) and silently deleted overrides that "matched" the base — so flipping a flag on, saving, then re-saving would silently revert to build-time default. Fix dropped the dedup; future "reset to default" should be a separate DELETE handler.

## Dependency relationships

- `federation` required for `federateHubs` and `seamlessFederation`
- `hubs` required for `federateHubs`
- `emailNotifications` requires SMTP/Resend env vars or it's a no-op
- `admin` gates its own nav item, but the middleware for `/admin/**` checks role ≥ admin as well — the flag controls whether the panel is **reachable at all**

## Typical production config

### Maker community (e.g. hack.build)
```ts
features: {
  content: true, social: true, hubs: true, docs: true, video: true,
  learning: true, explainers: true, editorial: true,
  contests: true, events: true,
  federation: true, federateHubs: true, seamlessFederation: true,
  admin: true, emailNotifications: true,
}
```

### Minimal instance (blog + docs only)
```ts
features: {
  content: true, social: true, hubs: false, docs: true, video: false,
  learning: false, explainers: false, editorial: false,
  contests: false, events: false,
  federation: false, federateHubs: false, seamlessFederation: false,
  admin: true, emailNotifications: false,
}
```

## Reference app config (`apps/reference/commonpub.config.ts`)

All features ON except `emailNotifications`. Good starting point for dev.

## Adding a new flag

1. Add field to `FeatureFlags` in `packages/config/src/types.ts` with JSDoc
2. Add default in `packages/config/src/schema.ts`
3. Bump `@commonpub/config` version
4. Update `apps/reference/commonpub.config.ts` and `apps/shell/commonpub.config.ts`
5. Set `runtimeConfig.public.features.<newFlag>` in `layers/base/nuxt.config.ts`
6. Gate it in:
   - server code: `if (!config.features.newFlag) throw ...`
   - route middleware: add path mapping if it owns a path
   - nav: add `requiredFeature: 'newFlag'` on NavItem entries
7. Document it here in this file
