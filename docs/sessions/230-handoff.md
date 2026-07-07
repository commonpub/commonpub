# Session 230 Handoff — featured hub, hub governance, SEO branding, admin community-override (ALL SHIPPED + LIVE on 3)

Date: 2026-07-06/07. Everything below is SHIPPED, published, deployed, and audited live on all three
instances (commonpub.io / deveco.io / heatsynclabs.io, all health 200).

**Current live stack: schema 0.56.0 · config 0.30.0 · server 2.105.0 · test-utils 0.5.10 · layer 0.97.0.**
Migration **0039_striped_loa** (hub_flags + steward enum) applied on all 3. Latest migration is 0039.
Consumer pins (deveco + heatsync): config ^0.30.0 / schema ^0.56.0 / server ^2.105.0 / layer ^0.97.0.
create-commonpub CLI **0.5.21** (re-pinned to ^0.56/^0.30/^2.105/^0.97 — current).

Auth still 0.9.0 · ui 0.13.1 · protocol 0.14.0 (unchanged this session).

**Follow-up wrap-up (2026-07-07, after the initial handoff — server 2.105.0 / layer 0.97.0):**
Completed the two F2 UI-visibility slices + extended platform-admin root perms across hub management.
- **Steward + platform-admin discussion moderation**: the post detail page's `isMod` now includes
  `steward` + `admin.access`, so stewards see pin/lock/delete (server already authorized them) and
  platform admins can moderate any community's posts.
- **Unlink button on share posts** (HubFeed): the sharer, a hub owner/admin, OR a platform admin can
  unlink a shared project; it's removed from the feed. Added `contentId` + `authorId` to the post view
  model. **Fixed a latent bug**: `unshareContent` deleted only the `hub_shares` row, leaving the share
  POST orphaned in the feed — it now also deletes the post + decrements `post_count`.
- **Platform-admin root perms** extended (via `{ asPlatformAdmin }` + route `hasPermission(event,
  'admin.access')`) to `deletePost`/`togglePinPost`/`toggleLockPost`/`unshareContent`/`deleteHub`/
  `changeRole`/`kickMember`/`listHubFlags`/`resolveHubFlag`. Member management preserves the OWNER
  invariant (admins can't change/kick the owner; owner reassigns only via `transferOwnership`). Hub
  detail shows Members/Invites/Settings to admins; members page + moderation queue treat admins as
  managers. Tests: `hub-root-admin.integration.test.ts` (5 cases). Live-verified: admin post controls
  on a non-member hub, unlink + full removal, admin management links. CLI re-pinned (0.5.21). Stale
  local branches pruned.

## Flag state per instance (verified live via /api/features)
| Flag | commonpub.io | deveco.io | heatsynclabs.io |
|---|---|---|---|
| featuredHub | OFF | **ON** | OFF |
| hubGovernance | OFF | **ON** | OFF |

Both flags default OFF; deveco's operator enabled them. Enable elsewhere via `/admin/features`.

## What shipped this session (5 releases)

1. **Per-instance SEO / embed branding** (a fix, not flagged — always on). `og:site_name` + titles now
   come from `instance_settings['instance.name']` → `config.instance.name`, runtime-editable with no
   redeploy, via a `seo-brand` client plugin (survives consumer app.vue overrides) + a
   `site-identity-prime` Nitro plugin + `getEffectiveSiteName`. **Verified live: og:site_name =
   `CommonPub` / `devEco.io` / `HeatSync Labs`** — the originally-reported "CommonPub in deveco embeds"
   bug is fixed.

2. **Featured hub** (flag `featuredHub`). `hubs.featuredId` instance-setting (no migration) + admin
   picker in `/admin/settings` → the chosen hub renders as a full-width `HubHero` atop `/hubs`,
   excluded from the grid. Server `getFeaturedHub` (null for unset/cleared/deleted/non-public/malformed).

3. **Hub governance** (flag `hubGovernance`, migration 0039). Owner **transfer-ownership** (atomic
   swap, owner→admin), **Steward** role (AUTHORITATIVE capability whitelist — moderates discussions +
   flags, never kick/ban/manage), **`hub_flags`** owner/admin review queue (advisory), and
   **self-unlink** of shared projects. UI: members page (steward option + badge + flag action + Review
   flags link), `/hubs/[slug]/moderation` queue, transfer section on settings.

4. **deveco featured-hub fork port** (deveco repo only). deveco overrides `pages/hubs/index.vue` +
   `pages/index.vue`, which shadowed the layer's featured-hub rendering, so the operator's featured hub
   never showed despite the flag being on. Ported the hero into deveco's `/hubs` page (full-width, above
   the grid) + pinned the featured community at the top of the homepage "Trending Communities" list, in
   deveco's own style. **This is deveco-only** — commonpub/heatsync homepages do NOT have a featured-hub
   section (only the layer `/hubs` page does).

5. **Platform-admin community-settings override (root)** — server 2.104.0 / layer 0.96.0. Instance
   admins (`admin.access`) can edit ANY community's settings (banner/icon/description/rules/privacy/
   join-policy/website) without being a hub member. `updateHub` gained `{ asPlatformAdmin }`;
   `PUT /api/hubs/[slug]` sets it from `hasPermission(event, 'admin.access')` (non-throwing,
   admin-floored); the hub detail page Settings link now shows for admins (`useCan('admin.access')`).
   **Verified live-local: admin edited banner+desc of a non-member hub (200); non-admin non-member 403.**

## Verification (audited)
- Typecheck 28/28. Full suites green: schema 509, config 29, test-utils 13, layer 1458, server 1571
  (the **5 email-outbox failures are pre-existing PGlite timing flakes** — confirmed identical on clean
  main; NOT a regression, do not chase before publishing).
- Release audit: all 3 Deploy Production runs completed/success; deveco CI green; published versions ==
  source (zero drift); consumer pins correct; all 3 health 200 + endpoints 200 + per-instance brand.
- Browser-verified end-to-end on the integration branch (all flags on, seeded hub + members): featured
  hero, steward promote→badge, flag→moderation→resolve (advisory), transfer ownership, admin picker,
  and live on deveco: featured hub on /hubs + homepage.

## Bugs caught in verification + fixed pre/post-release
- Featured-hub picker fetched `/api/hubs?limit=200` (>max 100) → 400 → empty dropdown. Fixed to 100.
- New flags rendered as raw keys in `/admin/features`; added flagMeta labels.
- **deveco CI typecheck went red** after layer 0.95: the new hub routes grew the typed-route manifest,
  collapsing the base `/api/hubs/[slug]` method union to GET in **deveco's own settings.vue fork**
  (TS2322 on PUT). Fixed with a loose `$fetch` cast in deveco's fork. (Local deveco typecheck is
  UNRELIABLE — phantom dual-@vue/reactivity Ref errors absent in CI; trust CI.)

## Open follow-ups (none blocking)
1. **Two F2 UI-visibility slices** (backends DONE + enforced + tested): steward visibility of
   pin/lock/delete controls on discussion posts, and the unlink button on share cards. Both need
   threading through the hub post-card component tree (`HubFeed` + the post-card component).
2. **create-commonpub CLI** pins are STALE (~^0.94-era). Re-pin `template.rs` to schema ^0.56 /
   config ^0.30 / server ^2.104 / layer ^0.96 + bump `tests/cli.rs` + republish to crates.io. Not an
   instance, so it didn't block this roll.
3. **deveco/heatsync `ENV_FLAG_MAP`** lacks `featuredHub`/`hubGovernance` — they enable via the
   `/admin/features` DB toggle (works for any flag). Add to their `server/utils/config.ts` map only if
   env-toggle is wanted.
4. **deveco forks heavily** (pages/hubs/index.vue, pages/index.vue, settings.vue, app.vue, layouts) —
   these SHADOW the layer, so any new layer UI feature needs porting to deveco's forks to appear there
   (the featured-hub port was a case in point). Option: realign deveco's forks closer to the layer so
   they inherit future features. heatsync forks far less (uses layer for hub pages).
5. **Homepage featured-hub is deveco-only.** If wanted on commonpub.io/heatsync, add a featured-hub
   section to the base layer's homepage (currently only the layer `/hubs` page has it).
6. **"Root perms" extension.** The platform-admin override currently covers `updateHub` (settings). The
   same one-line `{ asPlatformAdmin }` pattern extends to `deleteHub` / member management (changeRole/
   kickMember/banUser) / moderation if broader admin control is wanted (each needs the option + a
   client affordance). Deferred pending a request.
7. **GDPR export** of hub_flags / referral data (parity with session-227 GDPR work).
8. **Local branch hygiene** (commonpub repo): stale MERGED branches safe to prune —
   admin-hub-override, integration-230-verify, seo-instance-branding, contests, monolith-splits,
   audit-203-fixes, contest-builder-ux-p2456. `featured-hub` + `hub-governance` show UNMERGED but their
   CONTENT is in main (merged via integration-230-verify); their tips are redundant. Pre-existing old:
   fix/e2e-prod-webserver, rbac-activation-and-contest-editors.

## Landmines / lessons (this session)
- **Consumer forks shadow the layer.** deveco overrides many pages; a layer feature won't appear there
  until ported. Check `ls deveco-io/pages/...` before assuming a layer change reaches deveco.
- **Typed-route manifest TS2589/TS2322.** Adding server routes grows the Nuxt typed-`$fetch` manifest;
  once past a complexity threshold it collapses method unions / trips "excessively deep" in unrelated
  components. Remedy (codebase convention): loose `$fetch` cast or `@ts-ignore TS2589` per site. Verify
  layer type changes in the CONSUMER (deveco) CI, not just commonpub — they diverge.
- **deveco local typecheck is contaminated** (phantom dual-@vue/reactivity Ref errors). Trust deveco CI.
- **Featured-hub picker limit cap.** `hubFiltersSchema` caps `limit` at 100; requesting more 400s.
- SEO brand plugin (not app.vue) is what makes `og:site_name` survive deveco's app.vue override.

## Docs
- Session log: `docs/sessions/230-featured-hub-governance-seo.md`. Plan (with audit revisions):
  `docs/plans/hub-featured-roles-and-seo-branding.md`. STATUS.md TL;DR updated.
