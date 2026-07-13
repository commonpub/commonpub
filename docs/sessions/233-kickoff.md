# Session 233 Kickoff — roll the `contest-registration-reminders` stack (+ optional test-send)

## Paste this into the new session

> Finish rolling the `contest-registration-reminders` branch to production. Read CLAUDE.md,
> `docs/sessions/231-handoff.md` (the security-batch roll sequence + curl checklist), and
> `docs/sessions/232-contest-email-template-editor.md`. Then `curl /api/features` on all 3 instances
> before ANY flag claim. The branch bundles THREE unrolled workstreams (P1 security batch +
> registration/reminders + email editor) — confirm scope, run the FULL `pnpm test` + typecheck, then
> publish the packages in dependency order, apply migrations 0040 + 0041, deploy, and run the post-deploy
> curl checklist + Meili reindex. Flags ship OFF. No AI attribution, no em dashes. ultrathink the roll
> sequence; verify each publish landed on npm before the next (propagation lag is real).

## State (as of session 232, 2026-07-12)

Branch **`contest-registration-reminders`** (NOT pushed / merged / rolled). Over `main` it contains:

1. **P1 security batch** (`b6e8049e`, `df0486f3`, `e3cf8c8c`, `4fb0af34`) — unauth content/hub privacy
   leak fixes on all read paths, RBAC privilege-ceiling, `forkContent` visibility gate, private-hub AP
   federation gate. **These fix LIVE leaks** (memory `project_session_231_privacy_leak`) — the reason to
   roll is mostly this, not the two features.
2. **Registration + reminders** (`faa5bb3f`) — migration **0040**; new `contestReminders` flag (OFF).
3. **Email editor** (`3398feae` + polish `a96197d3`) — migration **0041**; new `contestEmailEditor`
   flag (OFF). Audited (no P0/P1) + live-verified. See `docs/sessions/232-*`.

All three ship behind default-OFF flags / are additive, so a deploy changes NO behavior until an operator
opts in — EXCEPT: the registration **confirmation** email is gated only on `emailNotifications` (not a
new flag), so on **deveco** (emailNotifications ON, console sink) a real registration will enqueue a
confirmation once deployed. Confirm that's intended before rolling deveco.

## Current versions (bump on publish)

`schema 0.56.0`, `config 0.30.0`, `infra 0.13.0`, `auth 0.9.0`, `server 2.105.0`, `layer 0.97.0`,
`editor 0.9.0`, `test-utils 0.5.10`.

## Roll sequence (dependency order — load-bearing)

The 231-handoff planned `schema → auth → server → layer`. The email editor ALSO touches **config** +
**infra**; the branch ALSO touches **editor** (the Callout/Quote caret fix) and **test-utils** (new
required flags in `mockConfig`) — both publishable and consumed by forks, so the publish set is 8
packages, not 6 (session-233 audit found the original 6-package list would leave the Callout fix and the
new flags out of the forks). Suggested order (each: bump, `pnpm test` green, publish, then **poll `npm
view` until the new version resolves before the next** — propagation lag, memory
`feedback_npm_propagation_lag`):

1. **`@commonpub/schema`** 0.56 → 0.57 (contests `email_copy` + reg/reminder tables + validators).
2. **`@commonpub/config`** 0.30 → 0.31 (new `contestReminders` + `contestEmailEditor` flags).
3. **`@commonpub/test-utils`** 0.5.10 → 0.5.11 (`mockConfig` gains the two now-REQUIRED flags; a fork
   building a test config from the published mockConfig fails typecheck against config 0.31 without this).
4. **`@commonpub/infra`** 0.13 → 0.14 (email token interpolation + `copy?` template param).
5. **`@commonpub/editor`** 0.9 → 0.10 (Callout/Quote reversed-text caret fix; re-exported from
   `vue/index.ts`, so forks only get it via an editor publish + a layer caret bump). No interdep with the
   others — just before layer.
6. **`@commonpub/auth`** 0.9 → 0.10 (RBAC signature changes from the security batch).
7. **`@commonpub/server`** 2.105 → 2.106 (privacy gates + contest email copy + registrations/reminders).
8. **`@commonpub/layer`** 0.97 → 0.98 via **`pnpm publish:layer`** (memory `feedback_pnpm_publish_layer`
   — never `npm publish` from layers/base; workspace:* literal). Bump the layer's `@commonpub/editor`
   caret too, or the caret fix won't reach the layer's published tree.

Then: **migrations 0040 + 0041** via `db-migrate.mjs` / `db:push` (never hand-edit prod DB — memory
`feedback_use_deploy_migrations_not_ssh`; both are additive/lock-safe). CLI re-pin
(`schema^0.57`/`server^2.106`/`layer^0.98`). Fork `package.json` 0.x caret bumps (hand-edit — memory
`feedback_caret_semver_0x_minor_bump`) + lockfiles (deveco npm gitignored / heatsync pnpm tracked —
memory `feedback_consumer_dual_lockfile_frozen_install`). **`POST /api/admin/search/reindex` per Meili
instance IMMEDIATELY post-deploy** (the visibility filter ships with the code that writes the field —
reindex AFTER, else search fails closed). Run the full **unauth curl checklist** from 231-handoff on all
3 instances (private slug absent, members/private 404, private-hub posts 403, AP surfaces 404, etc.).

### Session-233 additions to the curl checklist (two MORE same-class leaks found + fixed this session)

The pre-roll re-audit found the P1 security batch was still **incomplete** — two same-class private-hub
leaks the batch missed (both LIVE where `federateHubs`/`publicApi` are on):

- **P1 (fixed):** `GET /hubs/<private-slug>/posts/<post-uuid>` with `Accept: application/activity+json`
  served the private hub post Note (full `content`) unauthenticated — the per-post AP **middleware**
  `hub-post-ap.ts` wasn't in the batch's route list. Now gated `|| hub.privacy === 'private'`. **Add to
  curl checklist: this URL → 404** on every instance where `federateHubs` is on.
- **P2 (fixed):** `GET /api/public/v1/hubs/<private-slug>` with a `read:hubs` token returned a private
  hub's name + member/post counts (no-requester stub). Now 404s private, matching `listHubs`. **Add to
  checklist: this URL → 404** where `publicApi` is on (deveco).

**Fork-upgrade note (breaking signature):** `@commonpub/server` `createRole`/`updateRole`/
`setUserCustomRoles` now take a required `actor: ActorGrants` param (RBAC ceiling). In-repo layer routes
are updated; forks that call these directly must update. Latent behind `features.rbac` (OFF).

## Pre-roll gates

- `curl /api/features` on all 3 first (verified 2026-07-12: `contests` ON commonpub+deveco;
  `emailNotifications` ON deveco only; `federateHubs` ON commonpub+deveco — why the 2e AP gate matters).
- FULL `pnpm test` + typecheck across the monorepo (server 1682 + layer 1483 + reference vue-tsc were
  green in 232; re-run before publishing).
- Decide merge strategy: squash-merge to `main` (CLAUDE.md convention) as part of the roll, or roll from
  the branch then merge. The security fixes should land on `main`.

## Remaining feature work (optional, non-blocking)

- **Test-send** ("send test to me") — a `POST /api/contests/:slug/email-test` that enqueues ONE message
  through the outbox to the requesting editor's own verified address using the POSTed (unsaved) copy;
  same gates as the preview route; self-only. Scoped out of 232 to keep the core tight. Small.

## Why this wasn't auto-deployed in 232

The email-editor CODE is production-ready (3 audits, no P0/P1, live-verified, inert-when-off). But
"deploy" here = rolling a bundled, security-critical, multi-feature stack via irreversible npm publishes
to 3 live instances, with post-deploy reindex + unauth verification and behavior activation (deveco
confirmations). That is an operator-supervised roll, not a fire-and-forget — so it was handed off with
this precise sequence rather than executed blind. Run it step-by-step, verifying each stage.
