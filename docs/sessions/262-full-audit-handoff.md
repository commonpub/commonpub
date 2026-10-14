# Session 262 — full audit, then the live fixes (2026-10-13)

## Part 1: audit (read-only)

- Probed commonpub.io, deveco.io and heatsynclabs.io (GET/HEAD only): health, versions,
  flags, headers, compression, privacy, SSR, RSS/sitemap, og images.
- Re-verified all 47 P1s from the 08-23 and 08-30 audits against `main` code: 6 fixed,
  6 partial, 35 open.
- Checked all 43 plans in `docs/plans/` against code: roughly 13-17 done, 15-17 partial,
  6-7 not started, the rest superseded or abandoned.
- Architecture review: monoliths, release model, fork contract, route policy, tests, CSS,
  data layer, federation, flags.
- Rewrote the `docs/STATUS.md` header (it contradicted itself).

Report: `docs/reviews/2026-10-13-instances-and-codebase-audit.md`.

## Part 2: fixes (owner: "do all of that", with a contest in flight)

The owner asked for the "fix soon" list, done right, tested end to end, and deployed only
at full confidence. They asked to **hold off on the suspected bot accounts on deveco**
(no deletion or suspension until they review why they look fake); the `authprobe*` test
accounts were left alone for the same reason.

| Fix | Where |
| --- | --- |
| Account delete refuses while the account owns a contest, hub, docs site, event, learning path or product (409 naming them, before any federation Delete); DB backstop `ON DELETE RESTRICT` (migration 0050) | `admin.ts` `findSharedOwnership`, `AccountOwnsSharedContentError`; both delete routes; `settings/account.vue` shows the reason in place |
| A hub already handed over passes its creator credit to the current owner; a hub already deleted is removed | `deleteUser` |
| Audit entries and hub bans outlive their author (`SET NULL`); self-delete audit row written inside the transaction (was a post-commit FK 500) | migration 0050, `listAuditLogs`/`listBans` left joins |
| Suspended accounts hidden from everyone but themselves | `profile/visibility.ts` (status is now a required field of the gate) |
| Hub rosters and event attendee lists apply profile visibility; moderators/stewards/creator/admins see all; attendee `?status=` validated | `listMembers`, `listEventAttendees`, the two routes |
| Inbound activity: claim released and 500 on transient failure so the sender retries | `processActivityOnce` in `server/utils/inbox.ts`, all three inboxes |
| Missing pages 404 + noindex (`PageNotFoundStatus`); missing contest/event render the 404 page | 8 pages |
| `og-default.png` shipped by the layer (forks ship their own); og:image absolute everywhere | `useOgImage`, `seo-brand.ts` |
| Deploys wait for CI on the same commit; smoke checks `/contests`; previous image kept as `:previous` | all three deploy workflows |
| Caddy compression on the catch-all only, applied by `deploy/sync-caddyfile.sh` (only over a version the repo shipped; validate, reload, roll back) | commonpub + deveco Caddyfiles |
| deveco deploy: `pipefail`, in-container smoke that can fail | deveco `deploy-prod.yml` |
| heatsync: first CI workflow (npm, as the Dockerfile installs) | heatsync `ci.yml` |
| sharp 0.35.5, undici 7.30.0, docs 0.6.4 without its stale pins | deps |

**Decisions made**
- WebFinger is NOT gated: session 261 kept the actor for hidden profiles so their posts
  still federate, and WebFinger is how remote servers find that actor.
- Contest entrant names are not gated: an entry is published content, and bylines on
  published content stay visible, as everywhere else.
- Owned shared things block the delete rather than being reassigned automatically: no
  ownership silently changes hands during a live contest.

**Release (2026-10-14), live on all three, verified after each swap**
- Published: schema 0.68.0, protocol 0.15.5, infra 0.24.0, docs 0.6.4, auth 0.13.5,
  editor 0.17.4, explainer 0.9.3, learning 0.5.7, test-utils 0.5.19, server 2.140.0,
  layer 0.141.0 (rc.1 checked on deveco #46 and heatsync #42 first).
- commonpub.io (#98 squash 56ea38ac, then d7786218), deveco.io (#46, 82e57a3),
  heatsynclabs.io (#42, c57b307). Each: CI gate passed, migrate 0050 succeeded, smoke
  passed, Caddyfile synced (commonpub, deveco) or already current (heatsync).
- The first commonpub deploy failed safely: a second scp right after the image copy was
  reset by the droplet during the SSH handshake; nothing was loaded. The sync files now
  ride in the same scp as the image (d7786218, and in both forks before they merged).
- Found while testing: a fatal createError on the server logs every mistyped contest URL
  as a request error, so the contest/event 404 is fatal only in the browser.
- deveco's contest (judging, 22 entries) checked after the swap: page 200, judging portal
  redirects signed-out visitors, registrant and export routes 401. Its public judge list
  is empty: no judge has accepted yet (pre-existing, flagged to the owner).
- deveco's `.dockerignore` now excludes `.env*` and local secrets (a workstation build
  would have copied them into an image layer; CI checkouts never had them).

**Verification before release**: see PR #98 description (new tests mutation-checked; full suite; migration on
real Postgres with seeded data; built app against a dev-DB copy; real Caddyfile in front;
browser run at 390px; sharp on real files; production Docker image built).

## Open questions for the owner

1. deveco bot signups: review the evidence (30 newest of 457 accounts have random-letter
   usernames and matching mixed-case display names), then decide.
2. PR #92: merge (8-package cascade) or close?
3. Layout engine: finish it or freeze it on commonpub.io?
4. Release model: fold the small packages into server/layer and move to one version?
5. Persona: keep in the base layer or split into an optional layer?
6. `identity.*` flags and `auth.magicLink` / `auth.passkeys`: build or delete?

## Next steps

- Remaining audit P1s (report section 3): federation trust (N2/N3), unsanitised JSON on
  write (P1-6/7), forged federated DM sender (P1-3), password reset deliverability (N1),
  slug oracle (N7), public stats (P1-4), search index (P1-21), message pagination
  (P1-22), contrast (P1-24/25).
- The vue 3.5.32 copy in the workspace lockfile (dev/test only; the image traces 3.5.42).
- PR #92 and the contest scoring validator fixes each force the full cascade: batch them.
