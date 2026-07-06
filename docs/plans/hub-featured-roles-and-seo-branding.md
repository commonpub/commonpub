# Plan — Featured Hub, Hub Governance (transfer / steward / unlink), and Per-Instance SEO Branding

Status: PLANNED (not started). Author session: 230. Date: 2026-07-06.

Three independent feature requests, planned together because they were requested together. Each ships
as its own PR + release so they can be verified and rolled independently. Everything here is designed
as a **base CommonPub feature** (available to every instance, flag-gated, no instance-specific
hardcoding) per the standing rules.

Guiding rules honored throughout:
- **Schema is the work** (rule 1) — schema/migration decisions are made first in each feature.
- **No feature without a flag** (rule 2) — new flags: `featuredHub`, `hubGovernance`.
- **`var(--*)` only**, `cpub-` class prefix, WCAG 2.1 AA, TDD (tests first), no em dashes in copy.
- **Never credit Claude** in any commit/PR.
- Instance-local only; nothing here federates (add `hub_flags` + featured-hub to the "does not
  federate" list in `CLAUDE.md`).

Territory was mapped by three exploration passes; file:line anchors below are from that map.

---

## Feature 1 — Featured Hub (full-width hero atop the hubs listing)

**Goal:** an operator picks ONE hub to feature; it renders as a full-width hero tile (bordered,
aligned with the grid below) above the normal hub grid on `/hubs`, and is excluded from the grid.

**Decision (confirmed):** store a single `hubs.featuredId` in the existing `instance_settings`
key/value table (no migration), selected via an admin picker. Naturally enforces "exactly one," works
on every instance.

### Schema
- **No migration.** Reuse `instance_settings` (`packages/schema/src/admin.ts:5-11`, generic
  `key`/`value` jsonb). New key: `hubs.featuredId` (value = hub uuid string, or empty to clear).

### Config
- Add feature flag **`featuredHub`** (default `false`) to `@commonpub/config`
  (`packages/config/src/schema.ts` + `types.ts` FeatureFlags) and to the layer `nuxt.config.ts`
  `runtimeConfig.public.features` block (rule: every flag must be DECLARED there for env override —
  see nuxt.config.ts:94-101 comment) and to `apps/reference` `ENV_FLAG_MAP`.

### Server (`@commonpub/server`)
- `packages/server/src/hub/hub.ts` — add `getFeaturedHub(db)` that reads
  `getInstanceSetting(db, 'hubs.featuredId')` (`packages/server/src/admin/admin.ts:500`), then loads
  that hub via the existing local-hub projection (reuse the `localItems` mapper shape at hub.ts:58-72
  so the client gets an identical `HubListItem`). Returns `null` if unset, missing, deleted, or the
  hub is non-public (never feature a private hub in a public list).
- Do NOT reorder `listHubs`; keep the featured hub as a **separate** payload so grid pagination is
  untouched and the featured hub can also appear in the grid's excluded set cleanly.

### API (layer)
- `layers/base/server/api/hubs/featured.get.ts` (NEW) — public GET returning
  `{ featured: HubListItem | null }` via `getFeaturedHub`. Flag-gated: returns `{ featured: null }`
  when `!features.featuredHub`.
- `layers/base/server/api/hubs/index.get.ts` — optionally accept `excludeId` so the grid can drop the
  featured hub (or filter client-side; client-side is simpler and avoids a query change — prefer that).

### Admin UI
- `layers/base/pages/admin/settings.vue` — the current `knownSettings` array (settings.vue:15-22) is a
  plain text-input list. `hubs.featuredId` needs a **hub picker**, not a raw uuid field. Add a small
  dedicated control below the settings table: a `<select>` populated from `/api/hubs?limit=200`
  (local, public hubs), bound through the existing `saveSetting('hubs.featuredId', id)` →
  `PUT /api/admin/settings` path (settings.vue:34-49). Include a "None" option to clear.
- Gate the whole control behind `features.featuredHub` (`useFeatures()`).

### Public UI (the hero)
- `layers/base/pages/hubs/index.vue` — fetch `/api/hubs/featured` alongside `/api/hubs`. When
  `featured` is set AND `features.featuredHub`:
  - Render the existing, production-styled **`HubHero.vue`**
    (`layers/base/components/hub/HubHero.vue`) above `.cpub-hubs-grid` (index.vue:40). Map the
    `HubListItem` → `HubViewModel` the same way the detail page does (`hubs/[slug]/index.vue:51-67`;
    `foundedLabel` derived from `createdAt`). Wrap it in a `NuxtLink` to `hubLink(featured)`.
  - Filter the featured hub OUT of the grid `v-for` (index.vue:41) by id so it isn't shown twice.
  - Match the grid's alignment: the hero and the grid already share the page's `max-width: 960px`
    container (index.vue:82), so "bordered left/right, aligned with the tiles below" is satisfied by
    keeping the hero inside that container. Add a 2px border + offset shadow per the design system.
- Consider (optional, note only) reflecting the featured hub in the homepage `HubsSection.vue`
  sidebar — out of scope for v1.

### Tests (TDD, write first)
- `packages/server` integration: `getFeaturedHub` returns null when unset / when the target is
  deleted / when private; returns the mapped item when set to a public hub.
- Layer component test for `pages/hubs/index.vue`: hero renders + featured hub excluded from grid when
  flag ON and setting present; nothing renders when flag OFF or setting empty.
- axe pass on the hubs page with the hero present (WCAG 2.1 AA).

### Versioning
config (flag) → server (`getFeaturedHub`) → layer (API + UI). No schema publish, no migration.

---

## Feature 2 — Hub governance: transfer ownership, Steward role, unlink project

One flag gates all three: **`hubGovernance`** (default `false`).

### 2a. Owner transfers ownership to another member

**Current state:** ownership = the `hub_members` row with `role='owner'`
(`packages/schema/src/enums.ts:84-89`; there is no `ownerId` column). `changeRole` explicitly
**refuses** to create an owner (`members.ts:467-469`) and `leaveHub` blocks owners
(`members.ts:293-295`). No transfer function exists anywhere.

**Server** (`packages/server/src/hub/members.ts`, NEW `transferOwnership`):
```
transferOwnership(db, actorId, hubId, targetUserId)
```
- Authz: actor MUST currently be `role='owner'` of this hub (not admin, not moderator).
- Target MUST be an existing `active` member of the hub, and `!= actorId`.
- **Atomic** (`db.transaction`): set target's row to `role='owner'`, demote the former owner to
  `role='admin'` (keeps them a manager, not stranded). Exactly-one-owner invariant preserved.
- Bypasses the `changeRole` "cannot promote to owner" guard by being a separate, owner-only function.
- Guard against races: `SELECT ... FOR UPDATE` on both member rows inside the transaction.

**API:** `layers/base/server/api/hubs/[slug]/transfer-ownership.post.ts` (NEW) — body
`{ userId }` validated by a new `transferOwnershipSchema` (`packages/schema/src/validators/hub.ts`).
Flag-gated on `hubGovernance`.

**UI:** `layers/base/pages/hubs/[slug]/settings.vue` — add an owner-only "Transfer ownership" section
(a member `<select>` + a confirm dialog: "This makes <name> the owner. You become an admin. This
cannot be undone by you."). Only render when current user is owner AND flag ON.

### 2b. Steward role + hub-scoped flag queue

**Current state:** hub authz is a total-order hierarchy in `packages/server/src/utils.ts:22-54`
(`ROLE_HIERARCHY` owner4/admin3/moderator2/member1 + `PERMISSION_MAP`). This total order does NOT fit
Steward cleanly: a Steward can moderate the discussion board (delete/pin/lock posts, = moderator's
post powers) and flag projects/members, but must NOT kick/ban members or manage roles/resources.

**Design decision — refactor to an AUTHORITATIVE per-role capability set for Steward** (not a numeric
level):
- **Audit correction (critical):** `deletePost`, `kickMember`, and `banUser` are ALL numeric level 2
  (moderator) in the current `PERMISSION_MAP`. So Steward CANNOT be a numeric level-2 role with a
  "capability-hit → true, else numeric-fallthrough" check — it would inherit `kickMember`/`banUser`
  via the numeric path. The capability set must be a **whitelist that DENIES anything not listed**.
- Implementation: add `ROLE_CAPABILITIES: Partial<Record<HubRole, Set<Permission>>>` with a single
  entry: `steward → { deletePost, pinPost, lockPost, flagContent, flagMember }`. `hasPermission(role,
  perm)` becomes: **if the role has a capability set, that set is authoritative (`return
  caps.has(perm)` — no numeric fallthrough); otherwise use the existing numeric compare.** Existing
  roles (owner/admin/moderator/member) have no set → unchanged behavior, fully backward compatible.
  This guarantees Steward gets EXACTLY its whitelist and is denied kick/ban/manageMembers regardless
  of hierarchy number.
- `ROLE_HIERARCHY`: add `steward: 2` (alongside moderator). Used ONLY by `canManageRole` (who can
  change/kick whom): admin(3) can manage a steward; steward(2) can't manage moderator(2) or anyone
  it doesn't already lack the `manageMembers` perm for. Hierarchy number does NOT grant Steward any
  permission because the authoritative-set path bypasses the numeric map entirely.

**Schema (migration 0039 — additive):**
- Add `'steward'` to `hubRoleEnum` (`packages/schema/src/enums.ts:84`). Postgres `ALTER TYPE ... ADD
  VALUE`. Place it between `moderator` and `member` in declared order for readability (position does
  not affect the capability model).
- NEW table **`hub_flags`** (`packages/schema/src/hub.ts`):
  - `id` uuid PK, `hubId` uuid FK→hubs (cascade), `targetType` enum `('project','member')`,
    `targetId` uuid (content id or user id), `flaggedById` uuid FK→users, `reason` text,
    `status` enum `('open','dismissed','actioned')` default `'open'`, `resolvedById` uuid null,
    `resolvedAt` timestamp null, `createdAt`. Index `(hubId, status)`.
  - New enums `hubFlagTargetTypeEnum`, `hubFlagStatusEnum` in `enums.ts`.
  - `hub_flags` is **instance-local, never federates** (add to CLAUDE.md scope table).

**Validators (`packages/schema/src/validators/hub.ts`):**
- `changeRoleSchema` (hub.ts:62-65) += `'steward'` → `z.enum(['admin','moderator','steward','member'])`.
- `hubRoleSchema` (line 76) += `'steward'`.
- NEW `createHubFlagSchema` (`{ targetType, targetId (uuid), reason (string, capped) }`) and
  `resolveHubFlagSchema` (`{ status: 'dismissed'|'actioned' }`).

**Server:**
- `members.ts` `changeRole` — allow granting/removing `'steward'` (it already routes through
  `manageMembers` = admin+ and `canManageRole`; steward is a normal assignable role, unlike owner).
  Owners/admins grant Steward; the "cannot promote to owner" guard stays.
- `utils.ts` — add the capability override (above) so `hasPermission('steward', 'deletePost')` etc.
  return true and destructive perms return false.
- NEW `packages/server/src/hub/flags.ts`:
  - `createHubFlag(db, actorId, hubId, input)` — authz: actor is steward+ (has `flagContent`/
    `flagMember`). For `targetType='project'`, verify the project is shared to the hub
    (`hub_shares`); for `member`, verify the target is an active member. Insert `status='open'`.
    Idempotent-ish: one open flag per `(hubId, targetType, targetId, flaggedById)`.
  - `listHubFlags(db, actorId, hubId, {status})` — authz: owner/admin (review queue). Returns flags
    joined with target labels (project title / member name).
  - `resolveHubFlag(db, actorId, hubId, flagId, status)` — authz: owner/admin. Sets status +
    `resolvedBy/At`. **Resolving does NOT itself delete anything** — the owner then separately calls
    the existing destructive action (unshare / kick) if they choose. Steward flags are advisory.
- Export the new functions from `packages/server/src/index.ts`.

**API (layer, all flag-gated on `hubGovernance`):**
- `api/hubs/[slug]/flags/index.post.ts` (steward+: create) and `index.get.ts` (owner/admin: list).
- `api/hubs/[slug]/flags/[flagId].patch.ts` (owner/admin: resolve).

**UI:**
- `pages/hubs/[slug]/members.vue` — the role `<select>` (members.vue:166-179) gains a **Steward**
  option; `canManage` (members.vue:12) already covers owner/admin. Add a "Flag member" action visible
  to stewards (calls the flags API). Show a small "Steward" badge on steward rows.
- Discussion board / posts (`pages/hubs/[slug]/posts/[postId].vue`) — the existing moderator-only
  delete/pin/lock controls should now also render for stewards. They are gated client-side by role;
  update those checks to include `'steward'` (the server already authorizes via `hasPermission`).
  Add a "Flag project" affordance where shared projects are shown.
- NEW `pages/hubs/[slug]/moderation.vue` — owner/admin-only flag review queue: list open flags
  (member + project), each with Dismiss / Actioned buttons and a link to the destructive action
  (unlink project = 2c; kick member = existing `members/[userId].delete`). Nav entry from the hub
  settings/members area, gated on owner/admin + flag.

**Steward capability matrix (documented in the plan + a hub roles guide):**

| Capability | owner | admin | moderator | **steward** | member |
|---|---|---|---|---|---|
| Delete/pin/lock discussion posts | ✅ | ✅ | ✅ | **✅** | ✖ |
| Flag project / member for removal | ✅ | ✅ | ✅ | **✅** | ✖ |
| Kick / ban members | ✅ | ✅ | ✅ | **✖** | ✖ |
| Manage roles / resources / edit hub | ✅ | ✅ | ✖ | **✖** | ✖ |
| Review + resolve flag queue | ✅ | ✅ | ✖ | **✖** | ✖ |

### 2c. Member unlinks their own project from a hub

**Current state:** projects link to a hub via `hub_shares` (`packages/schema/src/hub.ts:183-199`).
`shareContent` (any active member; `posts.ts:712`) creates the row; **`unshareContent` already exists**
(`posts.ts:779`) and is correctly authz'd to the **original `sharedById` only** — but **there is NO
API route** exposing it (only `share.post.ts` exists). So 2c is largely "expose the existing
function + add a button."

- **API:** `api/hubs/[slug]/unshare.post.ts` (or `share.delete.ts`) (NEW) — body `{ contentId }`,
  calls `unshareContent(db, userId, hubId, contentId)`. The server already restricts to the sharer;
  owner/admin override can be added (allow owner/admin to unlink too, useful for the moderation
  "Actioned" path in 2b) — recommend: sharer OR `hasPermission(role,'deletePost')`.
- **UI:** on the hub page where shared projects are listed and on the project's own page, show an
  "Unlink from hub" control to the sharer (and owner/admin). Confirm dialog.
- **Note — products are separate.** `products.hubId` is `notNull` with only creator-only
  `deleteProduct` and no re-parent; "unlink a product" is out of scope (products aren't "linked
  projects" in the share sense). Call this out so it isn't mistaken for a gap.

### Tests (2a/2b/2c, TDD)
- `transferOwnership`: only owner can call; target must be a member; atomic swap leaves exactly one
  owner + demotes old owner to admin; concurrent transfer is serialized (real-Postgres harness).
- Steward: `hasPermission` matrix (steward CAN delete post / flag, CANNOT kick / ban / manageMembers);
  `changeRole` can grant/revoke steward; steward cannot be granted owner.
- Flags: create requires steward+; target validation (project must be shared, member must be active);
  list/resolve are owner/admin-only; resolving does not delete the target.
- Unshare API: sharer can unlink; non-sharer member cannot; owner/admin can; content row + share post
  handled per existing `unshareContent`.
- axe on new moderation page + updated members page.

### Versioning
schema (enum + `hub_flags`, migration 0039) → config (`hubGovernance` flag) → server (transfer +
capabilities + flags + unshare export) → layer (APIs + UI). Roll CLI pins after.

---

## Feature 3 — Per-instance SEO / embed branding (fix "CommonPub" in unfurls)

**Root cause (confirmed empirically):** the client/SSR head path builds every `<title>` / `og:title`
as `` `<thing>, ${useSiteName()}` `` and `useSiteName()`
(`layers/base/composables/useSiteName.ts:1-10`) reads `runtimeConfig.public.siteName`, which defaults
to `'CommonPub'` (`layers/base/nuxt.config.ts:92`) and is **never wired from the instance config** in
`apps/reference/nuxt.config.ts`. There is **no `og:site_name` tag anywhere** and **no
`titleTemplate`**, so unfurlers derive the brand from that title string. (Consumer forks like deveco
set `public.siteName` by hand; the reference/commonpub path doesn't, and nothing makes the
admin-settable Instance Name actually drive SEO.)

**Decision (confirmed):** brand is sourced from `instance_settings['instance.name']` (admin-editable,
runtime, no redeploy) falling back to `config.instance.name` — mirroring the session-229
`getEffectiveTermsVersion` pattern. This is a **fix**, not a flagged feature (no new flag).

### Server (`@commonpub/server`)
- Add `getEffectiveSiteName(db, fallback)` (mirror `getEffectiveTermsVersion`): reads
  `instance_settings['instance.name']`, coercing the PGlite/Postgres jsonb scalar to a string, else
  `fallback`. Analogous `getEffectiveSiteDescription` for `og:description`.

### Runtime prime (the "in settings, no redeploy" path) — mirror feature-flags-prime EXACTLY
**Audit correction:** the established convention in this repo is `event.context` + `useState` backed
by the 60s-cached `useConfig()` (see `server/plugins/feature-flags-prime.ts` + `useFeatures.ts`), NOT
process-global runtimeConfig mutation. Follow it exactly so SSR→client hydration matches (a plain
string `useSiteName()` would hydration-mismatch if the admin name differs from the build-time
`public.siteName`).
- **Extend the config merge** (`apps/reference/server/utils/config.ts`): today `refreshDbOverrides`
  only reads `features.overrides`. Add reads of `instance.name` / `instance.description` from
  `instance_settings` and have `buildMergedConfig` apply them to `mergedConfig.instance`. Now
  `useConfig().instance.name` is the effective, cached, runtime-editable name — a single source of
  truth that also benefits server emails/AP. (`getEffectiveSiteName` in `@commonpub/server` is still
  added for direct/test use + the SETTING_KEY constants, but the hot path uses cached `useConfig()`.)
- **NEW `layers/base/server/plugins/site-identity-prime.ts`** (mirror feature-flags-prime): on the
  `request` hook, `event.context.cpubSiteName = useConfig().instance.name` (+ description). Cached
  `useConfig()` = Map lookup, not a per-request DB hit.
- **`useSiteName()`** (`layers/base/composables/useSiteName.ts`): back it with
  `useState('cpub-site-name', () => useRequestEvent()?.context.cpubSiteName ?? runtimeConfig.public
  .siteName ?? 'CommonPub')` so the SSR value (from context) serializes to the client — no hydration
  mismatch. Keep the try/catch fallback for island/error paths.
- `layers/base/server/api/admin/settings.put.ts` already special-cases `theme.default` cache-busting
  (settings.put.ts:13-15) — add `instance.name`/`instance.description` to call
  `invalidateConfigCache()` so an admin name change takes effect on the next request (like
  termsVersion). Note: single-process bust; other replicas pick it up within the 60s TTL (documented).

### Static base default (covers first paint + non-DB fallback)
- `apps/reference/nuxt.config.ts` — wire the base defaults from config, mirroring how `instanceCookies`
  is already pulled from `siteConfig.config` (nuxt.config.ts:5-14):
  `siteName: siteConfig.config.instance.name`, `siteDescription: siteConfig.config.instance.description`
  (and `siteUrl`/`domain` if desired). This alone fixes the reference/commonpub.io case; the runtime
  prime layers on top for live edits and for forks.

### Global OG meta (the actual embed fix)
- **Implemented as a layer PLUGIN (`layers/base/plugins/seo-brand.ts`), NOT in `app.vue`.** Audit
  correction found during live verify: **deveco-io overrides `app.vue`**, so a layer `app.vue` head
  would be silently dropped there (the `consumer_layout_drops_layer_globals` trap) — and deveco is the
  instance with the reported bug. A layer plugin runs for every consumer regardless of their `app.vue`
  (same mechanism `theme.ts` uses). The plugin calls `useSeoMeta`:
  - `ogSiteName: <eager useSiteName()>` — the missing tag that names the brand in Discord/Slack. Must
    be resolved EAGERLY (plugins run during SSR with the request context; a lazy `() => useSiteName()`
    resolves during head resolution where `useRequestEvent()` is null → stale build-time brand).
  - `ogType: 'website'`, `twitterCard: 'summary_large_image'`. Pages still set their own
    title/ogTitle/ogImage (later `useSeoMeta` calls win).
  - **No global `ogImage` default shipped** — the referenced `/og-default.png` does not exist as an
    asset, so a global default would 404. Shipping a real per-instance default image is a separate
    optional follow-up (noted, not done).

### Hardcode cleanups
- `layers/base/error.vue:10` — `` `${statusCode}, CommonPub` `` → use `useSiteName()`.
- `layers/base/nuxt.config.ts:92-93` — keep `'CommonPub'`/`'A CommonPub instance'` as the LAST-resort
  layer default (correct for a bare layer), now shadowed by the reference wiring + runtime prime.
- `useSiteName.ts` fallback stays `'CommonPub'` (last resort).

### Consumer forks
- deveco/heatsync set `public.siteName` directly today; the runtime prime (reading their
  `instance_settings['instance.name']`) will override live. Document that they can now also just set
  the Instance Name in `/admin/settings` and the SEO updates without a redeploy. No fork code change
  strictly required, but note it in the release.

### Tests (TDD)
- `getEffectiveSiteName`: returns the DB setting when present (jsonb scalar coerced), else fallback.
- Composable/SSR test: `useSiteName()` prefers the request-context identity on the server.
- A rendered-head assertion (component/e2e) that a contest page emits `og:site_name` = instance name
  and a branded `og:title` (regression guard for the exact reported bug).
- Verify empirically post-deploy: `curl` a live contest URL, grep the head for `og:site_name` and the
  branded title.

### Versioning
server (`getEffectiveSiteName`) → layer (prime plugin + composable + global OG meta + error fix +
nuxt.config default og image) + `apps/reference/nuxt.config.ts` wiring. No schema, no migration, no
new flag.

---

## Cross-cutting: rollout order & release

Recommended PR/release order (each verified live before the next):
1. **Feature 3 (SEO)** first — smallest, highest user-visible value, no schema/migration, unblocks the
   reported embed bug. server + layer + reference config.
2. **Feature 1 (Featured Hub)** — config flag + server + layer; no migration.
3. **Feature 2 (Hub governance)** — largest; schema migration 0039 (steward enum + `hub_flags`) +
   config flag + server + layer. Ship last so the migration lands once, fully.

Per release, follow the STATUS.md §16 chain: bump changed packages in dep order
(schema → config → server → … → layer via `pnpm run publish:layer`), `pnpm typecheck` (28/28) + full
`pnpm test` (a per-package run can miss layer component regressions — session 229 lesson), PR →
squash-merge (commonpub.io deploys on push), then bump deveco/heatsync pins (BOTH lockfiles) + CLI
`template.rs`, curl-verify `/api/health` + a real route on all 3.

Flags land **OFF** (`featuredHub`, `hubGovernance`); enable per instance via `/admin/features` after
canarying on commonpub.io. SEO fix ships always-on (it is a correctness fix, not a feature).

## Docs to update
- `CLAUDE.md` federation scope table: add `hub_flags` (No / instance-local) and note featured-hub is
  an instance setting.
- NEW `docs/reference/guides/hub-roles.md` — the role/capability matrix + transfer/steward/flag flows.
- `docs/STATUS.md` + a `docs/sessions/230-*.md` log after each release.
