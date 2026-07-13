# Session 231 — Remediation Roadmap (master sequencing)

> Created 2026-07-12. The single entry point for everything the 6-round session-231 audit found,
> ordered by **verified real-world priority**. Every item is code-verified. Detailed specs live in
> the linked sub-plans; the GDPR-export and RBAC items are specced inline here (they had no prior
> doc). This roadmap supersedes the priority framing inside the individual plans.

## Status (updated 2026-07-12, branch `session-231-content-privacy`)

- **#1 Content/hub privacy — DONE** (P-1 `b6e8049e`, P-2, P-1b `df0486f3`). Roll-ready.
- **#2 GDPR export completeness — DONE** (`3de11931`).
- **#3 RBAC hardening — DONE** (`e3cf8c8c`; touched packages/auth + packages/schema).
- **NEXT: ROLL the security batch (#1-#3)** — publish schema→auth→server→layer + CLI re-pin + both
  lockfiles + Meili reindex; curl-verify. Then #4 Phase 0 (test-only), #5-7 federation (behind
  behavioral harnesses), #8 contest comms. Nothing pushed/published/rolled yet.

## The one-line story

Five audit rounds refined federation/email fixes; the **sixth, ground-up round found the real fire**:
a live, unauthenticated, systemic **content/hub privacy leak** that all prior rounds and the original
session-204 fix missed. That, plus an incomplete **GDPR export** and an **RBAC privilege-escalation
ceiling gap**, outrank the entire pre-existing backlog. The contest-communications work is a feature,
not risk-reduction, and should be sequenced last. And the meta-lesson: **static review has hit its
floor — the crypto/network/concurrency/UI boundaries are all mocked, so "SOLID" means
"static-reviewed, behaviorally unverified." Change medium (run things); don't add a 7th round.**

## Priority-ordered work

| # | Work | Sev | Live? | Effort | Schema? | Detail |
|---|------|-----|-------|--------|---------|--------|
| 1 | **Content & hub privacy enforcement** | P1/P0 | LIVE, unauth, all 3 | ~1-1.5 sess | no | `content-privacy-enforcement.md` |
| 2 | **GDPR data-export completeness** | P2 | LIVE, all 3, legal | ~0.5 sess | no | §GDPR below |
| 3 | **RBAC privilege ceiling + PII-wildcard** (DONE `e3cf8c8c`; event.create left ungated on purpose) | P2 | latent | ~0.5 sess | no | §RBAC below |
| 4 | **Phase 0 — outbox test date-bomb** | P1 (test-only) | CI | ~0.25 sess | no | `federation-email-audit-fixes.md` Phase 0 |
| 5 | **Federation live P2s** — negative-page 500 (1a), counter inflation (1b), **contest-notif dedup collision (1c)**, inbox amplification (2a) | P2 | LIVE-if-federating | ~1 sess | 2a: 1 mig | fixes plan Ph1/2a + round-5 |
| 6 | **Mirror ingestion gating (2b, upgraded → P1)** — storage ungated entirely, not just the cap | P1 | latent | ~0.5 sess | maybe col | fixes plan 2b + round-5 |
| 7 | **Federation + email latent hardening** — private-hub gate (2e), backfill actor-binding (2c), sanitizer DOMPurify (2d, P3), **email P3s** (List-Unsubscribe GET, send-time unsubscribe recheck, empty-AUTH_SECRET tokens, broadcast drain-gate/idempotency) | P2/P3 | latent | ~1-1.5 sess | some | fixes plan Ph2/3 |
| 8 | **Contest communications** (preference center, contest emails, reminders, winner) | feature | — | ~5-7 sess | migs | `contest-communications.md` |

**Do 1-3 first** (all live/legal, all server-only no-migration, all cheap), then 4, then the
federation work **behind behavioral gates**, and treat 8 as separate feature investment.

**Cross-plan dependencies + tracked residuals** (so nothing is lost):
- **#8 (contest comms) depends on 3 of #7's email P3s** — the List-Unsubscribe GET handler, the
  send-time unsubscribe recheck, and the broadcast drain-gate/idempotency (see
  `federation-email-audit-fixes.md` "contest-plan dependencies"). Sequence #7's email items before
  #8's email/broadcast work.
- **1c** (contest-notif dedup) is specced in BOTH `federation-email-audit-fixes.md` Phase 1c AND
  `contest-communications.md` Phase 1 — **do it once; #5/Phase-1c owns it**, contest-comms points to it.
- **Privacy P-1b LOW residuals** (in `content-privacy-enforcement.md`): anon `getHubBySlug` stub still
  returns the real hub id (no-requesterId path shared by write/AP callers → needs a read-scoped
  resolver); `createComment` write-abuse (a non-member can post into a private hub); `profileVisibility`
  latent surface (enum exists, no writer); the P-3 CI grep guard (regression backstop).
- **Latent perf smell** (session-231 audit): `listEvents` + `searchProducts` do a full `hubs WHERE
  privacy='private'` scan per request to build the exclusion. Correct but O(private-hubs) per call —
  add an index / cache if an instance grows many private hubs.

---

## §GDPR — data-export completeness (item 2)

**Verified:** `exportUserData` (`packages/server/src/profile/export.ts`) JSDoc claims "Satisfies GDPR
Article 20" (`:54`) and "match the deletion cascade's reach" (`:39-40`) — **false.** The
`onDelete: cascade` FKs reach ~30 tables; the export queries 17 and omits ~15 of subject data. This
is a live Art. 15/20 shortfall on a platform built around PII + consent + IP logging.

**Fix:** extend the two `Promise.all` batches (`export.ts:57-154`, `:158-246`) + the return object
(`:248-276`) + the `UserDataExport` interface (`:26-50`) + imports (`:2-23`).

**HIGH (authored/identifying — add):** `referral_links`/`referral_attributions` (owner+referred);
`hub_posts`/`hub_post_replies` (`authorId` — **all authored forum content, currently absent**);
`videos` (authorId); `learning_paths` (authorId); `products` (createdById), `docs_sites` (ownerId);
`reports` (reporterId — the user's own statements); `certificates` (userId); `files` (uploaderId);
`content_versions` (createdById); **G1**: `userConsents.ipAddress/userAgent`,
`contestAgreementAcceptances.ip`, `users.acceptedTermsAt/Version` (3-column additions to existing
selects).

**MEDIUM (engagement records — add):** hub_post_likes, hub_post_votes, poll_votes, hub_shares,
hub_invites (createdById), hub_resources (addedById), hub_flags (flaggedById), hub_bans (userId —
moderation record about them), lesson_progress, user_roles (roles held), api_keys (metadata only, not
the secret), federated engagement (federated_hub_post_likes/replies, user_federated_hub_follows),
message_reads.

**MUST NOT export (security/third-party — explicitly exclude + comment why):** `actor_keypairs`
(private keys), `sessions`/`accounts` (auth secrets), `audit_logs` (contains third-party targets),
`email_outbox`, `broadcasts`, `content_builds`/`federated_content_builds` (transient). Fix the JSDoc
to state the real (bounded) scope rather than claiming full cascade parity.

**Test:** a seeded user with a row in each HIGH table → export contains it; the MUST-NOT-export tables
are absent; no private key / session token leaks.

---

## §RBAC — hardening (item 3)

Three confirmed issues; all latent behind RBAC-on except event.create which is live.

**RBAC-5 — `roles.manage` has no privilege ceiling (self-escalation).** `sanitizeGrants`
(`rbac/admin.ts:75-80`) filters only `ADMIN_BYPASS_GRANTS = {*, admin.access, admin.*}` for non-admin
roles; every other catalog key passes. Exploit (each step gated only on `roles.manage`):
`POST /api/admin/roles` with `permissions:[users.manage, settings.manage, federation.manage,
content.moderate, contest.pii]` → `PUT /api/admin/users/<self>/roles` (no self-assign guard, no
"grant ≤ your own grants") → `invalidatePermissions` → live. **Fix:** plumb the acting user's own
resolved grants into `sanitizeGrants`/`createRole`/`updateRole` and reject any grant the actor
doesn't hold (a ceiling: you can't grant what you don't have). Add a self-assignment guard on the
roles.put route.

**RBAC-6 — `contest.*` subsumes `contest.pii`.** `hasPermissionPure` (`auth/permissions.ts:44-51`)
walks dotted prefixes, so `contest.*` satisfies `contest.pii` — which is the ENFORCED PII boundary
(`contests/[slug]/entries/[entryId]/private.get.ts:33`, `export.get.ts:33`). A "contest organizer"
role built with `contest.*` silently gains entrant-PII read. **Fix:** make `contest.pii` a
wildcard-exempt protected leaf in `hasPermissionPure`, OR reject `contest.*` as a storable grant in
`isPermissionGrant` (`schema/permissions.ts:90-92`). (Prefer the protected-leaf approach so other
`contest.*` perms still wildcard.)

**RBAC-7 — `event.create` DELIBERATELY LEFT UNGATED (shipped `e3cf8c8c`).** The round-6 draft said
"add `requirePermission(event,'event.create')`", but the RBAC audit found `event.create` is seeded to
**staff/admin only** — with `features.rbac` OFF (default) a normal member resolves to no grants, so a
bare gate would **403 every member's event creation** (a regression). It was left ungated (doc comment
only); the catalog key stays for a **future `config.instance.eventCreation` policy** (mirroring
`contestCreationPolicy`), not a permission gate. `contest.create`/`content.read` remain dead keys,
**kept** for forward-compat (not dropped).

**RBAC-8 (P3) — revocation cache staleness.** `PERMISSIONS_CACHE_TTL_MS=30_000`, per-process
(`utils/permissions.ts:25`); `invalidatePermissions` clears only the local node, so a revoked grant
lingers ≤30s on other pods. Documented "acceptable v1"; note it, fix only if multi-pod + RBAC-on
matters.

**Test:** a `roles.manage`-only user cannot mint/self-assign a role exceeding their own grants; a
`contest.*` role does NOT satisfy `contest.pii`; `event.create` gate blocks a non-granted user.

---

## Behavioral-verification doctrine (applies to items 5-8)

Baseline is real (verified by running: server typecheck clean; 5 failures, all the outbox date-bomb).
But the suite **mocks the entire crypto+network boundary** (`inbox.test.ts` `vi.mock('@commonpub/
protocol')`→verify=true; "two-instance" tests are direct calls with seeded actors — no HTTP, no
ports, no real signature), and asserts too loosely to catch the very bugs being fixed (reply-count
asserts `>=1` → passes under infinite inflation; dedup tests likes, never colliding contest events;
SKIP-LOCKED asserts a SQL string on single-connection PGlite; mirror-quota drives the unit path the
live routes don't wire). **So "SOLID" = static-reviewed, behaviorally unverified.**

**Do NOT ship on green unit tests alone:**
- **1/privacy, 5/1a** → real **HTTP-level** tests (unauth) against the actual routes.
- **2a (resolver cache), 2c (backfill binding), 2e (private-hub fed)** → a **network-instrumented
  two-instance signature round-trip** (undici `MockAgent` counting outbound fetches; a real signed
  inbound activity).
- **contest preference matrix** → **real-browser Playwright + axe** (keyboard + SR + v-model), not
  jsdom-axe.
- **contest reminder worker / outbox multi-replica** → a **real-Postgres concurrency harness** (N
  parallel `ON CONFLICT`/`SKIP LOCKED` claims; PGlite is single-connection and cannot prove this).

The fix for "every round finds more" is to **change medium**, not add a round.

---

## Cross-round correction ledger (what each round overturned)

- R2 refuted R1's "sanitizeBlockHtml no-op" premise (render layer IS a real sanitizer).
- R3 found several R1/R2 fixes had wrong blast radius (resolver-cache stalls all outbound; send-time
  recheck INNER JOIN drops null-user mail; mirror-cap no-op; page-clamp misses the hub route).
- R4 found deveco email is LIVE (not "OFF on all 3") and R8's `useConfig()` was architecturally
  impossible in the framework-agnostic server package; R2's negative-cache column infeasible.
- R5 (ground-up) found the systemic privacy leak, GDPR gaps, RBAC ceiling — the actual top risks.
- R6 corrected the privacy fix's own design (content isn't hub-scoped → `members`=author-only, not
  hub-membership) and confirmed all 19 sites + the GDPR/RBAC exploit paths.

Detailed sub-plans: `content-privacy-enforcement.md`, `federation-email-audit-fixes.md` (with
rounds-2/3/4/5 correction sections), `contest-communications.md` (with rounds-2/4 corrections).
