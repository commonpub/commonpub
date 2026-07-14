# Session 236 Handoff — post-234-roll state + audit + what's next

Date: 2026-07-14. Canonical current-state doc (successor to `234-handoff.md`; companion to `docs/STATUS.md`).
Verify any version/flag claim before trusting it: `npm view @commonpub/<pkg> version`,
`curl https://<instance>/api/features`, `cargo search create-commonpub`.

## LIVE in production — the 234 remediation batch is ROLLED to all 3 (verified 2026-07-14)

commonpub.io + deveco.io + heatsynclabs.io run:
`schema 0.57.0 / config 0.31.0 / test-utils 0.5.11 / infra 0.14.0 / editor 0.10.0 / auth 0.10.0 /
server 2.107.0 / ui 0.13.2 / layer 0.99.0`, migrations **0040 + 0041** (unchanged — the 234 roll added NO
migration). CLI **create-commonpub 0.5.22** (crates.io; pins `^0.99` layer / `^2.107` server / `^0.57`
schema / `^0.31` config). Flags unchanged: `contestReminders` + `contestEmailEditor` OFF on all 3;
`emailNotifications` deveco ON (console sink); `federateHubs` commonpub+deveco; `publicApi` +
`requireTermsAcceptance` deveco.

### The 7 fixes now live (from `234-backlog-remediation.md` + `235-roll.md`)
1. **comment-write access gate (HIGH security)** — `canAccessCommentTarget` gates both `listComments` (read)
   and `createComment` (write); route 404s. Closes private-hub / members-content comment+notification injection.
2. outbox negative-`?page=` → unauth-500 clamp (`safePage = Math.max(Math.trunc(page),1)`).
3. id-less inbound-reply dedup via `recordActivitySeen('reply:<uri>')` (no migration).
4. CLI re-pin (create-commonpub 0.5.22).
5. ENV_FLAG_MAP completeness (25→33 flags) + parity guard test.
6. StatBar label + kbd keycap WCAG AA (`--text-faint`→`--text-dim`).
7. P-3 CI tripwire banning un-audited raw `contentItems` reads.

## Post-roll audit (ultracode, 3 read-only verifiers + synth) — result: PASS

- **Artifact integrity PASS (the pnpm-10.10 file-drop guard):** packed the ACTUAL published tarballs. All
  fixes physically present in built dist — `canAccessCommentTarget` (server `dist/social/social.js:127`,
  wired to createComment `:240`), `safePage` (`dist/federation/outboxQueries.js:51,141`), reply dedup
  (`dist/federation/inboxHandlers.js:689`), a11y `--text-dim` in ui+layer `theme/layouts.css:190`. Layer
  0.99.0 froze `@commonpub/ui`→`0.13.2` + `@commonpub/server`→`2.107.0` exact (no `workspace:*` residue).
  **No file-drop occurred.**
- **Live behavioral PASS:** all 3 run server 2.107 — `/actor/outbox?page=-5|0|abc → 200` on each (a negative
  Postgres OFFSET would 500 without the clamp, so this is definitive). Comment gate does NOT over-block:
  unauth GET of public-blog comments → `200 []` on all 3. Flags unchanged (34 keys, contest flags false).
- **Release consistency PASS:** CLI tag captured the CORRECTED pins (`^0.99`/`^2.107`, not the stale
  `^0.98`/`^2.106` the branch commit left); all 3 repos clean + pushed; source drift confined to
  `packages/server/src`; branch fully merged (pruned). commonpub.io deploy `29309296189` success.

### Audit correction worth carrying forward
An audit sub-agent claimed "main CI red on `@commonpub/docs#test`, tripwire obscured." **That was a
misread.** Ground truth: on the latest main CI run the `check` job (Typecheck/Lint/**Test incl. docs + the
P-3 tripwire**/Build) is **GREEN**, `rust` GREEN. The ONLY red job is **`e2e`** — the known, pre-existing
e2e-prod-env auth-page failure (`toBeEnabled` timeout on the Register form; login works on the live sites,
so it's not a real bug — real gate is `smoke.mjs`, which passes). Not roll-related; my shipped code is
CI-green. WIP fix lives on branch `fix/e2e-prod-webserver` (see STATUS "known issues" / draft PR #7).

## Residual verification gaps (operator remainders — need creds / a session)
- **Comment-write gate, authenticated non-member path.** Read side + no-over-block proven live; the WRITE
  rejection needs 2 accounts: as a NON-member, POST `/api/social/comments` for a members-only/private-hub
  target → expect 404; confirm an authorized member still succeeds. (Deployed + unit/integration-tested.)
- **id-less reply dedup (live).** Needs a federated peer to replay a duplicate id-less `Create{Note,inReplyTo}`;
  confirm the second is deduped (single stored reply / a `reply:` row in `processed_activities`).
- **a11y StatBar browser render.** CSS proven in tarball + source-reading contrast guard (≥AA); visual
  render not screenshot-verified. Load a page with a StatBar; confirm `.cpub-stat-bar-label` computes
  `var(--text-dim)` ≥ 4.5:1 in both themes.
- **Meili reindex** `POST /api/admin/search/reindex` per instance (carried from the 233 roll — quality, not
  an outage; search falls back to Postgres FTS).

## REMAINING BACKLOG (carried from 234-handoff, still valid)

**Security/correctness (build-ready, no decision needed):**
- Federation §1c — contest lifecycle notification dedup collision (also a contest-comms Phase 1 prereq). P2.
- Federation §2a — inbox amplification via uncached 30s actor fetch (needs negative cache + key-rotation
  refetch; new `actor_resolution_failures` table = migration). P2.
- Federation §2c — backfill trusts outbox `actor` without host binding (attribution forgery). P2.
- Email P3 — send-time unsubscribe recheck; broadcast drain-gate + idempotency. P2.
- monolith-4b — extract `inboxHandlers.onCreate` (~1500 lines) behind new inbound-Create tests. P2.

**Needs a PRODUCT/DESIGN decision before building (do NOT build blind):**
- **Federation mirror-storage gate (§2b, P1)** — naive mirror-only gate OVER-BLOCKS; needs "wanted content"
  semantics (follow-status + mirror + size/rate policy). Deferred by both design + verify in session 234.
- **profileVisibility enforcement** — field non-writable (inert); correct fix = a dedicated feature (writer +
  shared-helper enforcement across all 6 profile-read paths), not a partial gate. Deferred in session 234.
- Federation §2e R9/R10 hub-fed lifecycle (public→private orphans remote followers; needs `federateHubDelete`
  + `pending_deletion`).
- **Contest communications Phases 1/2/4** — preference center + notification→email bridge; judge/stage/winner
  emails; winner announcement + "message entrants". Reminders shipped Phase 3 only.
- **Layout engine** Phases 4-10 (commonpub.io-only canary). Strategic go/no-go.
- **instance-self-update** — plan "awaiting maintainer approval".

**Tech-debt / hygiene (small):**
- **Fix the `e2e` job / get main CI green** (branch `fix/e2e-prod-webserver`) — the red baseline masks future
  regressions; every red run currently needs manual triage.
- Fork ENV_FLAG_MAP drift (deveco/heatsync + apps/shell maps still partial; the reference guard doesn't
  cover them — a per-repo parity test).
- a11y `--accent`-as-link/nav-text (2.67:1) — design decision, deferred with session 224.
- Rotate the DO Spaces secret (shared plaintext since session 200).
- Merged branches pruned this session (session-234-remediation, session-231-content-privacy,
  contest-registration-reminders local+remote). `rbac-activation-and-contest-editors` remains (old WIP).

## Landmines / disciplines (carry forward)
- **0.x caret pins do NOT cross minors** — `^0.98` will not install `0.99`; hand-edit CLI (`template.rs` +
  `cli.rs`) + fork `package.json` on every layer minor bump. This bit the branch (CLI shipped stale `^0.98`
  until corrected pre-roll). [[feedback_caret_semver_0x_minor_bump]]
- **Published with pnpm 10.10.0** — it has silently dropped dist files before; ALWAYS pack the published
  tarball and grep for the fix symbols post-publish (did this session — clean). [[feedback_pnpm_install_drops_files]]
- **@commonpub/ui theme reaches forks via the LAYER, not a ui pin** — `layers/base/scripts/bundle-theme.mjs`
  copies `packages/ui/theme` into the layer tarball at `pnpm publish:layer`. A ui npm publish is only needed
  when the ui VERSION is bumped (layer freezes `workspace:*` → exact; never bump-without-publish).
- **deveco `pnpm nuxt typecheck` fails LOCALLY** (DOM `CSSStyleSheet`/`adoptedStyleSheets` conflict + vue-tsc
  OOM in files a roll never touches) — local node_modules contamination. Trust the fork's CLEAN CI, not local
  vue-tsc, for consumer typecheck signal.
- **deploy.yml has `paths-ignore: docs/**`** — docs-only commits do NOT redeploy commonpub.io (a code/config
  commit still does).
- Deploy health is **warn-only** on the forks — curl-verify `/api/health` + a real behavioral route (the
  outbox clamp is a good server-version probe). commonpub.io's `smoke.mjs` is hard-fail.
- Run `pnpm test` with NO dev server + no dev-DB mutation (concurrent runs flake integration tests).
- Forks: bump layer+server carets + regen lockfiles — deveco `pnpm-lock.yaml`; heatsync BOTH
  `package-lock.json` + `pnpm-lock.yaml`. [[feedback_consumer_dual_lockfile_frozen_install]]
- TDD (tests first), no feature without a flag, `var(--*)` only, explicit return types, no `any`, no AI
  attribution in commits, no em dashes in user-facing copy.
