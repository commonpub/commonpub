# Audit: live instances + `main` codebase (2026-10-13)

Session 262. Read-only audit of commonpub.io, deveco.io and heatsynclabs.io (GET/HEAD
only) and of `main` at `ae506fb4`, with both forks read at `origin/main` (deveco-io
`7af209c`, heatsynclabs-io `7ac8707`). Four parallel passes: live probes, re-verification
of every earlier P1 against code, a per-plan backlog check, and an architecture review.
Spot-checked by hand before writing: og-default 404, contest cascade FK, suspend path,
inbox dedup ordering, deveco bot signups.

Nothing was changed by this audit. Every "open" below was confirmed in code or live,
not taken from a session doc.

## 1. Verified live state

| | commonpub.io | deveco.io | heatsynclabs.io |
|---|---|---|---|
| `/api/health` | ok, db ok | ok, db ok | ok, db ok |
| Layer | 0.140.0 (monorepo `fd20a3f4`) | 0.140.0 | 0.140.0 |
| Boolean flags | 52 (47 top level + 5 `identity.*`) | 52 | 52 |
| ON | 29 | 44 | 21 |
| HTML/asset compression | **none** | **none** | gzip/zstd |
| Last deploys | success | success | success |

All 15 published packages match `main`; no unreleased source since `fd20a3f4`.
Security headers (HSTS preload, frame-ancestors none, nosniff, referrer policy, CSP),
immutable `/_nuxt` caching and `/api/*` rate-limit headers are correct on all three.
Anonymous probes of every contest PII route return 401. `/api/users/:name` carries no
email, notification or role fields. No 500 on any swept page. RSS and sitemaps parse.

## 2. Act now (live, operator-visible)

1. **deveco.io is taking a bot-signup wave.** The 30 newest of 457 accounts all have
   random-letter usernames (`gdxrhcazuquctvsjyla`, display `GDXrHCAzuqUcTvSJyLa`),
   created 2026-09-25 to 2026-10-13. Only 139 of 457 are email-verified. deveco sends
   real mail through Resend, so each signup can send a verification mail to an unknown
   address (sender reputation). They are in the sitemap and in people lists. Nothing in
   `docs/plans/fake-account-handling.md` is built: no disposable-domain block, no
   Turnstile, no bulk suspend, no status filter on `/admin/users`.
2. **Compression is off on commonpub.io and deveco.io.** `deploy/Caddyfile` and
   `deveco-io/deploy/Caddyfile` lack `encode zstd gzip` (heatsync has it, line 2). About
   5x on HTML and JS. One line each.
3. **`/og-default.png` is 404 on all three**, and is emitted as a relative URL. It is the
   og:image fallback for hubs, profiles, learning paths and cover-less posts and
   contests, so every one of those shares with a broken preview. The file is not in the
   repo.
4. **Missing pages return 200**, not 404: `/u/<nobody>`, `/hubs/<nope>`,
   `/contests/<nope>`, `/docs/<nope>`, `/u/x/project/nope` (about 150 KB each, indexable,
   title echoes the path).
5. **Test accounts in production:** `authprobe*` users on commonpub.io (3 of 9) and
   heatsync (4 of 10), in sitemaps and nodeinfo counts.

## 3. Still-open P1s (re-verified in code)

Of 47 P1s from the 08-23 and 08-30 audits: **6 fixed, 6 partial, 35 open.** Full table
with file:line evidence in the session-262 task output; the substance:

### Privacy and security
- **Account deletion cascades (N12/N13).** `contests.createdById`, `hubs`, docs,
  products, learning paths and events are `onDelete: 'cascade'`
  (`packages/schema/src/contest.ts:479-481` and siblings). An organizer deleting their
  own account deletes the live contest and every entry. Deleting a moderator lifts their
  bans; deleting an admin erases their audit trail. Fix: `set null` / reassign, and
  block self-delete while owning shared entities.
- **Suspension does not hide a profile (P1-1).** Suspend writes `status` and clears
  `deletedAt` (`admin.ts:409`); the session-261 visibility gate and `profile.ts` check
  only `deletedAt`. Fix: add `status = 'active'` to `canViewProfile` / `profileVisibleTo`.
- **Profile visibility gaps left after #97 (P1-1 partial).** Hub member rosters
  (`hub/members.ts:359`), event attendee lists (`events.ts:285-302`), contest entrant
  lists and WebFinger (`routes/.well-known/webfinger.ts`, confirms a private username)
  do not apply `profileVisibleTo`. Follower lists still miss `isNull(deletedAt)`. The
  sweep guard only walks `api/users/[username]/`. Widen it to every read of `users`.
- **Self-delete 500s (P1-5).** The audit row is written with the just-deleted user's id,
  FK fails after commit, the byte purge never runs. GDPR erasure is broken via the UI.
- **Forged federated DMs (P1-3).** `inboxHandlers.ts:565,580` store inbound DMs with
  `senderId` = the local recipient.
- **Unsanitised JSON on write (P1-6/P1-7).** Federated `cpub:blocks` stored raw
  (`inboxHandlers.ts:802,1109`) and copied raw on fork (`content.ts:1286`); explainer
  write sanitiser cleans 6 of 18 fields. Render-time guards exist; storage is dirty.
- **Federation trust (N2/N3).** Any signed actor can publish into the public federated
  timeline without a follow. The activity id is not bound to the signer host and the
  dedup table is never purged.
- **Inbox loses activities.** `routes/inbox.ts` records the id as seen *before*
  processing and returns 400 on any handler error. A transient failure drops the
  activity for good: 4xx tells the sender not to retry, and a retry would dedup anyway.
- **OAuth dynamic client registration** (`auth/oauth2/register.post.ts`) is
  unauthenticated, first-come per `instance_domain`, with redirect URIs not bound to it.
  Needs a human security review.
- **Password reset skips `isEmailDeliverable()` (N1)**; **slug oracle redirect (N7)**
  leaks unpublished slugs; **`/api/stats` and nodeinfo (P1-4)** publish admin
  aggregates (draft/archived counts, role counts) and report version `0.0.1` with
  monthly-active equal to total.
- **Dependencies:** sharp 0.34.5 (libvips CVEs, every upload), undici `<7.29.1` in
  `packages/protocol` (TLS validation bypass), and the workspace lockfile resolves vue
  3.5.32 next to 3.5.42 (the shape of the September deveco outage; the built image only
  traces 3.5.42).

### Release and operations
- Monorepo deploy is not gated on tests (P1-14); CI never runs the real migrator
  (P1-12); migrations run after the container swap; `docker image prune` removes the
  rollback image.
- deveco deploy: health check cannot pass or fail (P1-10), no `pipefail` (P1-11), no
  `needs:` (P1-16). heatsync has no CI at all.
- Fork CI builds with pnpm, Docker with npm (P1-15). Fork `server/utils/config.ts` maps
  15 of 47 env flags and drops the admin-set instance name (P1-17).
- `create-commonpub` pins layer `^0.106.0`, 34 minors stale (P1-18).
- `docs/deployment.md` cannot be followed (N15-N19).
- `@commonpub/docs@0.6.3` still pins schema 0.16.0 + config 0.12.0 into both forks.

### Performance and accessibility
- Search is a leading-wildcard ILIKE seq scan; no tsvector/GIN or trigram index (P1-21).
- Message threads load unbounded (P1-22). Delivery is serial with no in-flight guard
  (P1-23).
- Three anonymous 500s from unvalidated ids/dates/enums (P1-9, N4, N5).
- Focus ring contrast (P1-24), `--text-faint` below AA (P1-25), unnamed controls
  (P1-26), deveco 320px reflow (P1-27), InteractiveContainer text colour (P1-28).
- 39 files format dates during SSR with no mount gate (timezone hydration class).

## 4. Rearchitecture, ranked

1. **Durable inbound federation queue + worker leases** (M). Persist the verified
   activity, return 202, process from a table with the `SKIP LOCKED` lease the email
   outbox already uses, mark seen on success. Order delivery by `next_attempt_at`. Twelve
   `setInterval` workers have no lease, so the app cannot run two replicas.
2. **Ship `useConfig()` from the layer** (S). 173 layer server files call it; each app
   carries its own copy and the fork copies have drifted (P1-17).
3. **Stop the exact-pin cascade** (M). Fold docs, learning, explainer, persona and
   theme-studio into server/layer, deprecate test-utils, move to one fixed version via
   Changesets at 1.0. Today a one-line schema change (PR #92) moves 8 packages.
4. **Fork contract for theming** (M). Put component styles in
   `@layer commonpub.components` with a declared order ending in an app layer, so fork
   CSS wins without `:root[data-theme]` tricks; let a registered fork theme outrank a
   stale DB `theme.default` (or warn in admin). Replace deveco's six shadowed pages with
   slots or the layout engine, and add a fork CI check for drift from shadowed files.
5. **One fork pipeline** (M). One package manager and lockfile; a reusable
   `workflow_call` CI+deploy from commonpub; deploy only after CI; migrate from the new
   image before the swap; keep the previous image.
6. **Declarative route policy** (M). `defineCpubHandler({ auth, perm, scope, feature })`
   instead of eight helper patterns across 405 routes; one `visibleUsers(viewer)`
   predicate covering visibility, status and deletedAt; move the 41 routes that query
   drizzle inline into `packages/server`.
7. **Route test harness + typechecked tests** (M). 38 of 58 layer server tests are source
   scans; 72 of 405 routes are executed by any test; 8 packages exclude tests from tsc.
8. **Search and pagination indexes** (S-M). Stored tsvector + GIN, pg_trgm for people,
   or switch on the existing Meilisearch adapter. 46 offset sites remain.
9. **Persona as an optional layer** (L). About 11.9k lines in the base layer for a
   feature ON only on deveco.
10. **`<CpubTime>` + lint ban on `toLocale*String` in .vue** (S-M), 79 call sites.
11. **Flag lifecycle** (S). Retire the 8 rollout flags ON everywhere
    (contestStageSubmissions, contestConditionalFields, contestSignup,
    contestEntryRequiresRegistration, contestActionBar, registrationBlock, themeStudio,
    contentImport); decide the 5 never-built `identity.*` flags and dead `auth.magicLink`
    / `auth.passkeys`.

## 5. Feature backlog (from 43 plans, checked against code)

13 done, 17 partial, 6 not started, 7 superseded/abandoned. About 20 plan headers say
"proposed" or "not rolled" for live work. Highest-value remaining items:

- **Contests:** decide PR #92 (mergeable, no conflicts, CI needs a re-run, forces an
  8-package cascade); notification dedup collision (every status change overwrites the
  previous notification); unify registration and entry P2-P4 (combined-mode entries show
  judges no answers); contest-communications phases 1b-4c (judge invites still never
  email; no winner email); session-260 scoring fixes (ties, weight 0 counts as 100,
  duplicate ids accepted); SSR `registrationTier` seeds null; teams (not started).
- **Accounts:** fake-account handling (not started, see section 2); `/admin/features`
  reset-to-default does nothing (PUT merges, no DELETE).
- **Persona/email:** saving notification prefs replaces the whole `emailNotifications`
  object (`profile.ts:182`), reported to re-subscribe a member who used one-click
  unsubscribe (needs a UI check). Disclosure purge runs only while `memberDirectory` is
  ON. deveco's directory is inert until a papered recipient is declared.
- **Email (deveco sends real mail):** no send-time unsubscribe recheck; outbox lease
  ignores owner (double-send on a stalled worker); `/admin/broadcast` has no
  idempotency or CR/LF subject guard; empty `AUTH_SECRET` falls back to `''`.
- **Federation:** mirror item cap not enforced (live); hub privacy lifecycle (no
  retraction on private or delete); hub post likes and remote hub unfollow exist
  server-side with no route.
- **Hubs:** polls are half-built (`createPollOptions` has no caller, so no poll can get
  options).
- **Layout engine:** phases 3e-10 open; homepage three-path consolidation blocks moving
  the canary beyond commonpub.io. Needs a go/no-go.
- **Docs/learning:** docs versions cannot be deleted or defaulted; module/lesson reorder
  has no route.
- **Not started:** instance self-update, team registration, persona-perfect-form,
  fake-account handling.
- **Dead code:** 5 unreferenced components, 43 server exports with no caller (including
  `cleanupExpiredCodes`, so OAuth codes are never purged).

## 6. Documentation drift

- `docs/STATUS.md` header contradicted itself (rewritten in session 262).
- `docs/plans/monolith-splits-remaining-backlog.md`: branch merged, line counts stale.
- `docs/ROADMAP.md` predates six plans and the audit P1s.
- `settings/privacy.vue:70` says consent history is "NOT YET IMPLEMENTED"; it exists.
