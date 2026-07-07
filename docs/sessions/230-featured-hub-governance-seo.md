# Session 230 — Featured hub, hub governance, per-instance SEO branding (SHIPPED + ROLLED to all 3)

Date: 2026-07-06/07. Three feature requests, planned + audited + built TDD + browser-verified +
released. Plan: `docs/plans/hub-featured-roles-and-seo-branding.md` (kept current with audit revisions).

**Released: schema 0.56.0 · config 0.30.0 · server 2.103.0 · test-utils 0.5.10 · layer 0.95.0.**
Migration **0039_striped_loa** (hub_flags + steward enum + two flag enums). New flags
`featuredHub` + `hubGovernance` default **OFF** (enable via `/admin/features`). Rolled to
commonpub.io (push main) + deveco.io + heatsynclabs.io (pins ^0.56/^0.30/^2.103/^0.95, both lockfiles).

## What shipped

### 1. Per-instance SEO / embed branding (a fix, not flagged)
Root cause (confirmed empirically): every `<title>`/`og:title` used `useSiteName()`, which read
`runtimeConfig.public.siteName` — defaulted to `'CommonPub'`, never wired from instance config — and
there was **no `og:site_name` tag at all**, so unfurlers derived the brand from the title. The
admin-settable "Instance Name" was also cosmetic.
- `@commonpub/server`: `getEffectiveSiteName`/`getEffectiveSiteDescription` (+ setting-key consts),
  mirroring `getEffectiveTermsVersion`. Brand = `instance_settings['instance.name']` → `config.instance
  .name`, runtime-editable with no redeploy.
- Reference `config.ts`: `useConfig()` now DB-merges `instance.name`/`description` (was features-only);
  `settings.put` invalidates the cache on rename.
- Reference `nuxt.config`: wire `public.siteName`/`siteDescription` from `config.instance.*`.
- `site-identity-prime` Nitro plugin (mirrors feature-flags-prime): primes `event.context.cpubSiteName`.
- `useSiteName()`: `useState` seeded from request context (no hydration mismatch).
- **`seo-brand` PLUGIN** (not app.vue) emits `og:site_name` — survives consumer app.vue overrides
  (deveco overrides app.vue; a layer app.vue head would be dropped there).
- `error.vue`: instance brand instead of hardcoded 'CommonPub'.

### 2. Featured hub
Instance-setting `hubs.featuredId` (no migration) + admin picker; one hub renders as a full-width
`HubHero` band atop `/hubs`, excluded from the grid. Flag `featuredHub`. `getFeaturedHub` returns null
for unset/cleared/deleted/non-public/malformed-uuid.

### 3. Hub governance (flag `hubGovernance`)
- **Transfer ownership**: owner-only, atomic (FOR UPDATE) swap target→owner + former owner→admin.
- **Steward role** (migration 0039 enum): AUTHORITATIVE capability whitelist (deletePost/pinPost/
  lockPost/flagContent/flagMember) — critical because kickMember/banUser share numeric level 2 with
  deletePost; a fallthrough would leak them. Steward moderates + flags, never kick/ban/manage.
- **`hub_flags`** table + queue: `createHubFlag` (steward+, validates target in hub, upsert reopens),
  `listHubFlags`/`resolveHubFlag` (owner/admin, advisory — never removes the target).
- **Unlink**: `unshareContent` now allows the sharer OR owner/admin; exposed via `unshare.post.ts`.
- UI: members page (steward option + badge + flag action + "Review flags" link), `/hubs/[slug]/
  moderation` queue, transfer-ownership section on settings.

## Verification
- Typecheck 28/28. Full suites green: schema 509, config 29, test-utils 13, layer 1458, server 1570
  (the 5 email-outbox failures are pre-existing PGlite timing flakes, confirmed identical on clean main).
- New server tests: permission matrix (steward grants + denials, no numeric leak), transferOwnership
  (owner-only/atomic/guards), flags (authz/target-validation/upsert/advisory), getFeaturedHub,
  getEffectiveSiteName; + useSiteName composable.
- **Live browser verification** (integration branch, all flags on, seeded hub + 4 members): featured
  hero + grid exclusion; SEO og:site_name + branded titles; steward promote → badge; flag member →
  moderation queue → resolve (advisory, member kept); transfer ownership (owner→admin swap); admin
  picker + feature toggles.

## Bugs found in browser testing (both fixed before release)
1. Featured-hub picker fetched `/api/hubs?limit=200` but the filter caps limit at 100 → 400 → the
   dropdown showed only "None" (admin couldn't pick a hub). Fixed to `limit=100`.
2. `featuredHub`/`hubGovernance` rendered as raw keys in `/admin/features`; added `flagMeta` labels.

## Release execution
Bumped 5 versions → full suites → published in dep order (schema → config → server → test-utils →
layer via `pnpm run publish:layer`; verified exact pins, no `workspace:` leak, all bracketed-path route
files packed) → pushed main (commonpub.io deploy, migration 0039) → bumped deveco/heatsync pins + BOTH
lockfiles → pushed (deploys apply 0039 via db-migrate.mjs). All three curl-verified: health 200 +
`featuredHub`/`hubGovernance` keys in `/api/features`.

## Remaining (documented follow-ups)
- **F2 UI-visibility slices** (backends done + enforced + tested): steward visibility of pin/lock/delete
  on discussion posts; the unlink button on share cards. Need threading through the hub post-card tree.
- **create-commonpub CLI** pins stale (still ^0.94-era) — re-pin to ^0.56/^0.30/^2.103/^0.95 + republish
  to crates.io when convenient (not an instance, so not blocking this roll).
- deveco/heatsync `ENV_FLAG_MAP` lacks the new flags (they enable via the `/admin/features` DB toggle).
- deveco/heatsync don't get the runtime instance.name→SEO merge (their own config.ts); their build-time
  `public.siteName` already brands correctly, so no regression — runtime-editable is an enhancement.

## Follow-on releases (same session, after the initial 3 features)

- **deveco featured-hub fork port** (deveco repo, commit `22fddad`): deveco overrides
  `pages/hubs/index.vue` + `pages/index.vue`, shadowing the layer's featured-hub rendering, so the
  operator's featured hub didn't show despite the flag being on. Ported the hero into deveco's `/hubs`
  page + pinned the featured community atop the homepage Trending list, in deveco's own style.
  deveco-only (commonpub/heatsync homepages have no featured section).
- **Platform-admin community-settings override** (server **2.104.0** / layer **0.96.0**): instance
  admins (`admin.access`) can edit ANY community's settings (banner/icon/description/rules/privacy/
  join-policy/website) without hub membership. `updateHub { asPlatformAdmin }` + PUT route gate on
  `hasPermission(event, 'admin.access')` + Settings link via `useCan('admin.access')`. Non-admin
  non-members 403. Rolled to all 3 (no migration).

Authoritative current-state doc: **`docs/sessions/230-handoff.md`**.
